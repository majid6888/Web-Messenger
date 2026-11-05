import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause } from 'lucide-react';
import { sounds } from '../services/audio';

interface VoiceRecorderProps {
  onSend: (dataUrl: string, durationSec: number) => void;
  onCancel: () => void;
}

type VoiceEffect = 'normal' | 'radio' | 'helium' | 'robot';

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<VoiceEffect>('normal');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      setErrorMsg(null);
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine best supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          setAudioUrl(base64data);
        };
      };

      recorder.start(150); // slices of 150ms
      sounds.playRecordStart();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      setErrorMsg('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const handleSend = () => {
    if (audioUrl) {
      onSend(audioUrl, Math.max(1, duration));
      cleanup();
    } else if (isRecording) {
      // Stop and then send once blob is ready
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = () => {
            const base64data = reader.result as string;
            onSend(base64data, Math.max(1, duration));
            cleanup();
          };
        };
        mediaRecorderRef.current.stop();
      }
    }
  };

  const togglePreview = () => {
    if (!audioUrl) return;
    if (!previewAudioRef.current) {
      previewAudioRef.current = new Audio(audioUrl);
      previewAudioRef.current.onended = () => setIsPlayingPreview(false);
    }

    // Set playback rate based on selected voice effect
    if (selectedEffect === 'helium') {
      previewAudioRef.current.playbackRate = 1.35;
    } else if (selectedEffect === 'radio') {
      previewAudioRef.current.playbackRate = 0.88;
    } else if (selectedEffect === 'robot') {
      previewAudioRef.current.playbackRate = 0.95;
    } else {
      previewAudioRef.current.playbackRate = 1.0;
    }

    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play().then(() => {
        setIsPlayingPreview(true);
      }).catch(() => {});
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  if (errorMsg) {
    return (
      <div className="flex items-center justify-between gap-3 w-full bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-2xl">
        <span className="text-xs">{errorMsg}</span>
        <button
          type="button"
          onClick={handleCancel}
          className="text-xs bg-red-800 hover:bg-red-700 px-2.5 py-1 rounded-lg text-white"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 w-full bg-slate-900 border border-indigo-500/40 px-3 py-2 rounded-2xl shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Delete / Discard */}
      <button
        type="button"
        onClick={handleCancel}
        className="w-9 h-9 rounded-full bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-colors shrink-0"
        title="Cancel voice note"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      {/* Recording status or Preview status */}
      <div className="flex-1 flex items-center gap-3 px-2">
        {isRecording ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping shrink-0" />
              <span className="text-sm font-semibold text-slate-100 tabular-nums">
                {formatTime(duration)}
              </span>
            </div>
            <div className="flex-1 flex items-center gap-1 overflow-hidden h-6">
              {[40, 80, 50, 95, 60, 100, 75, 45, 90, 65, 80, 55, 90, 70, 40].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="w-1 bg-red-500/70 rounded-full animate-pulse"
                />
              ))}
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium flex items-center gap-1"
            >
              <Square className="w-3 h-3 text-red-400 fill-current" />
              Done
            </button>
          </>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={togglePreview}
                className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-colors shrink-0"
              >
                {isPlayingPreview ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>
              <span className="text-xs text-slate-300 font-medium">
                {formatTime(duration)}
              </span>
            </div>

            {/* Voice Effect Chips */}
            <div className="flex items-center gap-1 overflow-x-auto text-[11px] no-scrollbar">
              {[
                { id: 'normal', label: '🎙️ Normal' },
                { id: 'radio', label: '📻 Radio' },
                { id: 'helium', label: '🐿️ Helium' },
                { id: 'robot', label: '🤖 Robot' },
              ].map((eff) => (
                <button
                  key={eff.id}
                  type="button"
                  onClick={() => {
                    setSelectedEffect(eff.id as VoiceEffect);
                    if (previewAudioRef.current && isPlayingPreview) {
                      previewAudioRef.current.pause();
                      setIsPlayingPreview(false);
                    }
                  }}
                  className={`px-2 py-0.5 rounded-md font-medium transition whitespace-nowrap ${
                    selectedEffect === eff.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {eff.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Send */}
      <button
        type="button"
        onClick={handleSend}
        className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-transform active:scale-95 shadow-md shadow-indigo-600/20 shrink-0"
        title="Send voice note"
      >
        <Send className="w-4 h-4 ml-0.5" />
      </button>
    </div>
  );
};
