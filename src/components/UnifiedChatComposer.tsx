import React, { useState, useRef, useEffect } from 'react';
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  Trash2,
  Check,
  X,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  BarChart3,
  Gamepad2,
  Clock,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { ReplyReference } from '../types';
import { sounds } from '../services/audio';
import { api } from '../services/api';
import { EmojiPicker } from './EmojiPicker';

interface UnifiedChatComposerProps {
  conversationId?: string;
  onSendMessage: (payload: {
    text: string;
    type: 'text' | 'image' | 'voice' | 'video' | 'file';
    mediaUrl?: string;
    videoUrl?: string;
    thumbnail?: string;
    fileName?: string;
    mediaDuration?: number;
    mediaName?: string;
    mediaSize?: number;
    replyTo?: ReplyReference;
  }) => void;
  replyTo?: ReplyReference | null;
  onCancelReply?: () => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  onOpenPollModal?: () => void;
  onOpenScheduleModal?: () => void;
  onOpenActivityModal?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export interface StagedMedia {
  type: 'image' | 'video' | 'file';
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  thumbnail?: string;
  duration?: number;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadSpeed?: string;
  uploadEta?: string;
  remoteUrl?: string;
  error?: string | null;
}

export const UnifiedChatComposer: React.FC<UnifiedChatComposerProps> = ({
  conversationId,
  onSendMessage,
  replyTo,
  onCancelReply,
  onTypingStart,
  onTypingStop,
  onOpenPollModal,
  onOpenScheduleModal,
  onOpenActivityModal,
  placeholder = 'Type a message...',
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Staged Media Attachment (Photos & Videos with Caption support)
  const [stagedMedia, setStagedMedia] = useState<StagedMedia | null>(null);

  // Video Upload States
  const [videoUploadState, setVideoUploadState] = useState<{
    isUploading: boolean;
    progress: number;
    fileName: string;
    file?: File;
    error: string | null;
  }>({
    isUploading: false,
    progress: 0,
    fileName: '',
    error: null,
  });

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  // Drag/slide cancel detection
  const [slideCancelActive, setSlideCancelActive] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const isHoldingMicRef = useRef(false);
  const recordStartTimeRef = useRef<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const typingTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow textarea height to fit content smoothly
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [text]);

  // Typing tracking
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    if (onTypingStart) {
      onTypingStart();
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        if (onTypingStop) onTypingStop();
      }, 2000);
    }
  };

  const handleSendMessageWithMedia = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = text.trim();

    // 1. If media is staged (Photo, Video, File)
    if (stagedMedia) {
      if (stagedMedia.isUploading) {
        // Video is still uploading, do not dispatch until complete
        return;
      }
      if (stagedMedia.error) {
        return;
      }

      sounds.playMessageSent();

      if (stagedMedia.type === 'video') {
        onSendMessage({
          text: clean,
          type: 'video',
          mediaUrl: stagedMedia.remoteUrl || stagedMedia.previewUrl,
          videoUrl: stagedMedia.remoteUrl || stagedMedia.previewUrl,
          thumbnail: stagedMedia.thumbnail,
          fileName: stagedMedia.name,
          mediaName: stagedMedia.name,
          mediaSize: stagedMedia.size,
          mediaDuration: stagedMedia.duration,
          replyTo: replyTo || undefined,
        });
      } else if (stagedMedia.type === 'image') {
        onSendMessage({
          text: clean,
          type: 'image',
          mediaUrl: stagedMedia.remoteUrl || stagedMedia.previewUrl,
          fileName: stagedMedia.name,
          mediaName: stagedMedia.name,
          mediaSize: stagedMedia.size,
          replyTo: replyTo || undefined,
        });
      } else {
        onSendMessage({
          text: clean,
          type: 'file',
          mediaUrl: stagedMedia.remoteUrl || stagedMedia.previewUrl,
          fileName: stagedMedia.name,
          mediaName: stagedMedia.name,
          mediaSize: stagedMedia.size,
          replyTo: replyTo || undefined,
        });
      }

      // Cleanup preview URL if blob
      if (stagedMedia.previewUrl && stagedMedia.previewUrl.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(stagedMedia.previewUrl);
        } catch {}
      }

      setStagedMedia(null);
      setText('');
      if (onCancelReply) onCancelReply();
      if (onTypingStop) onTypingStop();
      setShowEmojiPicker(false);
      setShowAttachMenu(false);

      if (textareaRef.current) {
        textareaRef.current.style.height = '40px';
      }
      return;
    }

    // 2. Standard text message
    if (!clean) return;

    sounds.playMessageSent();
    onSendMessage({
      text: clean,
      type: 'text',
      replyTo: replyTo || undefined,
    });

    setText('');
    if (onCancelReply) onCancelReply();
    if (onTypingStop) onTypingStop();
    setShowEmojiPicker(false);
    setShowAttachMenu(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }
  };

  // Keyboard shortcut: Enter = Send, Shift + Enter = New line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Allow Shift + Enter to add newline
        return;
      }
      e.preventDefault();
      handleSendMessageWithMedia();
    }
  };

  // Insert emoji at cursor position
  const handleSelectEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((prev) => prev + emoji);
      return;
    }

    const start = textarea.selectionStart ?? text.length;
    const end = textarea.selectionEnd ?? text.length;
    const updated = text.substring(0, start) + emoji + text.substring(end);
    setText(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    }, 0);
  };

  // Voice Recording Management
  const startRecording = async () => {
    try {
      setMicError(null);
      setSlideCancelActive(false);
      audioChunksRef.current = [];
      recordStartTimeRef.current = Date.now();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select clean supported MIME type
      let mimeType = 'audio/webm';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      sounds.playRecordStart();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone permission or hardware error:', err);
      setMicError('Microphone permission denied or unavailable');
      setIsRecording(false);
      isHoldingMicRef.current = false;
      setTimeout(() => setMicError(null), 3500);
    }
  };

  const stopAndSendRecording = () => {
    if (!isRecording && !mediaRecorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const elapsedSeconds = Math.max(
      1,
      recordingDuration,
      Math.round((Date.now() - (recordStartTimeRef.current || Date.now())) / 1000)
    );

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch {}

      recorder.onstop = () => {
        const rawMime = recorder.mimeType || 'audio/webm';
        const cleanMime = rawMime.includes('mp4') ? 'audio/mp4' : 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: cleanMime });

        if (blob.size > 0) {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
            const base64 = reader.result as string;
            sounds.playMessageSent();
            onSendMessage({
              text: '',
              type: 'voice',
              mediaUrl: base64,
              mediaDuration: elapsedSeconds,
              replyTo: replyTo || undefined,
            });
            if (onCancelReply) onCancelReply();
          };
        }
        cleanupMediaStream();
      };

      recorder.stop();
    } else {
      cleanupMediaStream();
    }

    setIsRecording(false);
    isHoldingMicRef.current = false;
    setSlideCancelActive(false);
    setRecordingDuration(0);
  };

  const cancelRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        cleanupMediaStream();
      };
      mediaRecorderRef.current.stop();
    } else {
      cleanupMediaStream();
    }

    setIsRecording(false);
    isHoldingMicRef.current = false;
    setSlideCancelActive(false);
    setRecordingDuration(0);
  };

  const cleanupMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
  };

  // Hold-to-record events for Desktop & Mobile
  const handleMicMouseDown = () => {
    if (disabled || isRecording) return;
    isHoldingMicRef.current = true;
    startRecording();
  };

  const handleMicMouseUp = () => {
    if (isHoldingMicRef.current) {
      isHoldingMicRef.current = false;
      stopAndSendRecording();
    }
  };

  const handleMicTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRecording) return;
    isHoldingMicRef.current = true;
    touchStartXRef.current = e.touches[0].clientX;
    startRecording();
  };

  const handleMicTouchMove = (e: React.TouchEvent) => {
    if (!isHoldingMicRef.current || touchStartXRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const deltaX = touchStartXRef.current - currentX;
    if (deltaX > 60) {
      setSlideCancelActive(true);
    } else {
      setSlideCancelActive(false);
    }
  };

  const handleMicTouchEnd = () => {
    if (isHoldingMicRef.current) {
      isHoldingMicRef.current = false;
      touchStartXRef.current = null;
      if (slideCancelActive) {
        cancelRecording();
      } else {
        stopAndSendRecording();
      }
    }
  };

  // File Upload Helpers
  // Client-side video thumbnail & duration extractor
  const generateVideoThumbnailAndDuration = (
    file: File
  ): Promise<{ thumbnail?: string; duration?: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      video.preload = 'metadata';
      video.src = objectUrl;
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
        video.removeAttribute('src');
        video.load();
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve({});
      }, 5000);

      video.onloadedmetadata = () => {
        const dur = Math.round(video.duration) || undefined;
        video.currentTime = Math.min(1, Math.max(0.1, video.duration / 2 || 0.5));
      };

      video.onseeked = () => {
        clearTimeout(timeoutId);
        try {
          const canvas = document.createElement('canvas');
          const width = Math.min(640, video.videoWidth || 480);
          const height = Math.round((width / (video.videoWidth || 16)) * (video.videoHeight || 9));
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, width, height);
            const thumb = canvas.toDataURL('image/jpeg', 0.7);
            cleanup();
            resolve({ thumbnail: thumb, duration: Math.round(video.duration) || undefined });
            return;
          }
        } catch (e) {
          console.warn('Video thumbnail capture error:', e);
        }
        cleanup();
        resolve({ duration: Math.round(video.duration) || undefined });
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        cleanup();
        resolve({});
      };
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Video Upload Execution (Stages video with live thumbnail, duration, and background upload)
  const startVideoUpload = async (file: File) => {
    const validMimes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      'video/x-matroska',
      'video/x-msvideo',
      'video/3gpp',
      'video/x-flv',
    ];
    const validExts = ['.mp4', '.webm', '.mov', '.mkv', '.ogg', '.m4v', '.3gp'];
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const isVideo = file.type.startsWith('video/') || validMimes.includes(file.type) || validExts.includes(ext);

    if (!isVideo) {
      setStagedMedia({
        type: 'video',
        file,
        previewUrl: '',
        name: file.name,
        size: file.size,
        isUploading: false,
        error: 'Please select a valid video file (MP4, WebM, MOV, MKV).',
      });
      return;
    }

    if (file.size > 150 * 1024 * 1024) {
      setStagedMedia({
        type: 'video',
        file,
        previewUrl: '',
        name: file.name,
        size: file.size,
        isUploading: false,
        error: 'Video exceeds maximum file size limit of 150MB.',
      });
      return;
    }

    // 1. Generate thumbnail & duration immediately for instant UI staging
    let thumb = '';
    let dur: number | undefined;
    try {
      const extracted = await generateVideoThumbnailAndDuration(file);
      thumb = extracted.thumbnail || '';
      dur = extracted.duration;
    } catch (e) {
      console.warn('Thumbnail generation skipped:', e);
    }

    const previewUrl = URL.createObjectURL(file);

    // 2. Stage media directly in composer bar with caption support
    setStagedMedia({
      type: 'video',
      file,
      previewUrl,
      thumbnail: thumb,
      duration: dur,
      name: file.name,
      size: file.size,
      isUploading: true,
      uploadProgress: 0,
      error: null,
    });

    // Keep focus in message bar so user can type caption while video uploads
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);

    // 3. Upload file with real-time percentage progress, speed, and ETA
    const startTime = Date.now();
    try {
      const result = await api.uploadVideo(conversationId, file, {
        duration: dur,
        thumbnail: thumb,
        onProgress: (percent, loaded, total) => {
          const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const bytesPerSec = loaded / elapsedSec;
          const speedMB = (bytesPerSec / (1024 * 1024)).toFixed(1);
          const remainingBytes = Math.max(0, total - loaded);
          const remainingSec = bytesPerSec > 0 ? Math.ceil(remainingBytes / bytesPerSec) : 0;

          const etaStr =
            remainingSec > 60
              ? `~${Math.ceil(remainingSec / 60)}m left`
              : `~${remainingSec}s left`;

          setStagedMedia((prev) =>
            prev && prev.file === file
              ? {
                  ...prev,
                  uploadProgress: percent,
                  uploadSpeed: `${speedMB} MB/s`,
                  uploadEta: etaStr,
                }
              : prev
          );
        },
      });

      setStagedMedia((prev) =>
        prev && prev.file === file
          ? {
              ...prev,
              isUploading: false,
              uploadProgress: 100,
              remoteUrl: result.videoUrl,
              thumbnail: result.thumbnail || prev.thumbnail,
              duration: result.duration || prev.duration,
              error: null,
            }
          : prev
      );
    } catch (err: any) {
      console.error('Video upload failed:', err);
      setStagedMedia((prev) =>
        prev && prev.file === file
          ? {
              ...prev,
              isUploading: false,
              error: err?.message || 'Video upload failed. Tap retry to try again.',
            }
          : prev
      );
    }
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startVideoUpload(file);
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if the selected file is a video
    if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv|ogg|m4v|3gp)$/i)) {
      startVideoUpload(file);
      e.target.value = '';
      setShowAttachMenu(false);
      return;
    }

    // 1. Create instant local preview URL
    const previewUrl = URL.createObjectURL(file);

    // 2. Stage image in composer immediately with caption support
    setStagedMedia({
      type: 'image',
      file,
      previewUrl,
      name: file.name,
      size: file.size,
      isUploading: false,
    });

    // 3. Populate base64 dataUrl in background for instant sending
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setStagedMedia((prev) => (prev && prev.file === file ? { ...prev, remoteUrl: dataUrl } : prev));
    };
    reader.readAsDataURL(file);

    // Keep focus in message bar for caption
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);

    e.target.value = '';
    setShowAttachMenu(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if the selected file is a video
    if (file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|mkv|ogg|m4v|3gp)$/i)) {
      startVideoUpload(file);
      e.target.value = '';
      setShowAttachMenu(false);
      return;
    }

    // Stage file attachment in composer
    const reader = new FileReader();
    reader.onloadend = () => {
      setStagedMedia({
        type: 'file',
        file,
        previewUrl: '',
        remoteUrl: reader.result as string,
        name: file.name,
        size: file.size,
        isUploading: false,
      });
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 80);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      cleanupMediaStream();
    };
  }, []);

  return (
    <div className="relative w-full bg-white border-t border-slate-200/80 px-3 py-2 sm:px-4 sm:py-3 transition-colors shadow-sm select-none">
      {/* Hidden File Inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska,video/*"
        className="hidden"
        onChange={handleVideoSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Staged Media Preview Card (Photos, Videos, Files with Caption support) */}
      {stagedMedia && (
        <div className="mb-2.5 bg-slate-50 border border-slate-200/90 rounded-2xl p-2.5 shadow-sm flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Image Preview */}
            {stagedMedia.type === 'image' && (
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shrink-0">
                <img
                  src={stagedMedia.previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Video Preview with Live Thumbnail and Duration Pill */}
            {stagedMedia.type === 'video' && (
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center">
                {stagedMedia.thumbnail ? (
                  <img
                    src={stagedMedia.thumbnail}
                    alt="Video thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <VideoIcon className="w-6 h-6 text-indigo-400" />
                )}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <VideoIcon className="w-4 h-4 text-white drop-shadow-md" />
                </div>
                {stagedMedia.duration !== undefined && (
                  <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-bold px-1 rounded tabular-nums">
                    {formatTimer(stagedMedia.duration)}
                  </span>
                )}
              </div>
            )}

            {/* File Preview */}
            {stagedMedia.type === 'file' && (
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <FileText className="w-5 h-5" />
              </div>
            )}

            {/* Metadata and Status */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 truncate block">
                  {stagedMedia.name}
                </span>
                <span className="text-[10px] text-slate-500 font-medium tabular-nums shrink-0">
                  {formatFileSize(stagedMedia.size)}
                </span>
              </div>

              {/* Status / Uploading / Error indicator */}
              {stagedMedia.isUploading ? (
                <div className="mt-1">
                  <div className="flex items-center justify-between text-[11px] text-indigo-600 font-semibold mb-1">
                    <span className="flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Uploading video...
                    </span>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {stagedMedia.uploadSpeed && (
                        <span className="text-slate-500 font-mono">{stagedMedia.uploadSpeed}</span>
                      )}
                      {stagedMedia.uploadEta && (
                        <span className="text-slate-400 font-mono">• {stagedMedia.uploadEta}</span>
                      )}
                      <span className="tabular-nums font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {stagedMedia.uploadProgress || 0}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-150"
                      style={{ width: `${Math.max(5, stagedMedia.uploadProgress || 0)}%` }}
                    />
                  </div>
                </div>
              ) : stagedMedia.error ? (
                <div className="flex items-center gap-1.5 text-xs text-rose-600 mt-0.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{stagedMedia.error}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (stagedMedia.file) startVideoUpload(stagedMedia.file);
                    }}
                    className="ml-1 text-[11px] font-bold underline hover:text-rose-700 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Ready • Add a caption below & press Send
                </p>
              )}
            </div>
          </div>

          {/* Dismiss / Remove Media Button */}
          <button
            type="button"
            onClick={() => {
              if (stagedMedia.previewUrl && stagedMedia.previewUrl.startsWith('blob:')) {
                try {
                  URL.revokeObjectURL(stagedMedia.previewUrl);
                } catch {}
              }
              setStagedMedia(null);
            }}
            className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mic Permission / Error Banner */}
      {micError && (
        <div className="absolute -top-10 left-4 right-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium px-3 py-1.5 rounded-xl shadow-md text-center animate-in fade-in">
          {micError}
        </div>
      )}

      {/* Reply Banner */}
      {replyTo && (
        <div className="mb-2 flex items-center justify-between bg-slate-50 border-l-4 border-indigo-600 rounded-r-xl px-3 py-2 text-xs">
          <div className="min-w-0 flex-1 pr-2">
            <span className="font-bold text-indigo-600 block truncate">
              Replying to {replyTo.senderName}
            </span>
            <p className="text-slate-600 truncate mt-0.5">{replyTo.text || 'Media attachment'}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="w-6 h-6 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            title="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Menu Popup */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-3 sm:left-4 z-40 bg-white border border-slate-200 rounded-2xl p-2 shadow-xl shadow-slate-900/10 flex flex-col gap-1 w-52 animate-in fade-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              imageInputRef.current?.click();
              setShowAttachMenu(false);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
            <span>Photo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              videoInputRef.current?.click();
              setShowAttachMenu(false);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <VideoIcon className="w-4 h-4" />
            </div>
            <span>Video</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fileInputRef.current?.click();
              setShowAttachMenu(false);
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span>Document / File</span>
          </button>

          {onOpenPollModal && (
            <button
              type="button"
              onClick={() => {
                onOpenPollModal();
                setShowAttachMenu(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span>Group Poll</span>
            </button>
          )}

          {onOpenActivityModal && (
            <button
              type="button"
              onClick={() => {
                onOpenActivityModal();
                setShowAttachMenu(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <span>Mini-Game Duel</span>
            </button>
          )}

          {onOpenScheduleModal && (
            <button
              type="button"
              onClick={() => {
                onOpenScheduleModal();
                setShowAttachMenu(false);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-100 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <span>Schedule Capsule</span>
            </button>
          )}
        </div>
      )}

      {/* Rich Emoji Picker Popup */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Unified Message Composer Interface */}
      <div className="flex items-end gap-2 max-w-full">
        {/* If Recording: Smooth in-place recording interface */}
        {isRecording ? (
          <div className="flex-1 flex items-center gap-3 bg-rose-50/90 border border-rose-200 rounded-2xl px-3.5 py-2 animate-in fade-in duration-200 min-h-[44px]">
            {/* Pulsing Recording Indicator */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
              </span>
              <span className="font-mono text-xs font-bold text-rose-700">
                {formatTimer(recordingDuration)}
              </span>
            </div>

            {/* Audio Waveform Animation */}
            <div className="flex-1 flex items-center justify-center gap-0.5 h-5 px-2 overflow-hidden">
              {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 85, 60, 40, 75, 90, 55, 30].map(
                (h, idx) => (
                  <span
                    key={idx}
                    style={{ height: `${Math.max(20, ((h * (recordingDuration % 3 + 1)) % 100))}%` }}
                    className="w-1 bg-rose-400 rounded-full transition-all duration-150"
                  />
                )
              )}
            </div>

            {/* Slide to Cancel or Click to Cancel */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={cancelRecording}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                title="Cancel recording"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
                <span className="hidden sm:inline">Cancel</span>
              </button>

              {/* Finish & Send Voice Message */}
              <button
                type="button"
                onClick={stopAndSendRecording}
                className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 active:scale-95 transition-transform cursor-pointer"
                title="Send voice note"
              >
                <Check className="w-4 h-4 stroke-[3]" />
              </button>
            </div>
          </div>
        ) : (
          /* Normal State: [ Emoji ] [ Attachment ] [ Multiline Textarea ] [ Mic / Send ] */
          <>
            {/* Emoji Button */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setShowEmojiPicker((prev) => !prev);
                setShowAttachMenu(false);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors shrink-0 active:scale-95 cursor-pointer mb-0.5"
              title="Add Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Attachment Button */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setShowAttachMenu((prev) => !prev);
                setShowEmojiPicker(false);
              }}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full hover:bg-slate-100 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors shrink-0 active:scale-95 cursor-pointer mb-0.5"
              title="Attach media or launch feature"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Main Text Area Field (Supports Enter to send, Shift+Enter for newline) */}
            <div className="flex-1 min-w-0 relative">
              <textarea
                ref={textareaRef}
                value={text}
                disabled={disabled}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  stagedMedia
                    ? stagedMedia.type === 'image'
                      ? 'Add a caption for this photo...'
                      : stagedMedia.type === 'video'
                      ? 'Add a caption for this video...'
                      : 'Add a message or caption...'
                    : placeholder
                }
                rows={1}
                className="w-full bg-[#f1f3f7] hover:bg-[#ebedf3] focus:bg-white border border-transparent focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 text-sm rounded-2xl px-4 py-2.5 outline-none transition-all placeholder:text-slate-400 font-normal shadow-inner/10 resize-none leading-relaxed overflow-y-auto"
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
            </div>

            {/* Dynamic Action Button: Send if typed or media staged, Microphone if empty */}
            {text.trim().length > 0 || stagedMedia !== null ? (
              <button
                type="button"
                disabled={disabled || (stagedMedia?.isUploading ?? false)}
                onClick={() => handleSendMessageWithMedia()}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-600/25 active:scale-90 transition-transform shrink-0 cursor-pointer mb-0.5 disabled:opacity-50"
                title={
                  stagedMedia?.isUploading
                    ? `Uploading video (${stagedMedia.uploadProgress || 0}%)...`
                    : 'Send Message (Enter)'
                }
              >
                {stagedMedia?.isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                ) : (
                  <Send className="w-4 h-4 ml-0.5 stroke-[2.5]" />
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={disabled}
                onMouseDown={handleMicMouseDown}
                onMouseUp={handleMicMouseUp}
                onTouchStart={handleMicTouchStart}
                onTouchMove={handleMicTouchMove}
                onTouchEnd={handleMicTouchEnd}
                onClick={() => {
                  if (!isRecording) startRecording();
                }}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 flex items-center justify-center active:scale-90 transition-transform shrink-0 cursor-pointer mb-0.5"
                title="Press & hold or click to start voice note"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
