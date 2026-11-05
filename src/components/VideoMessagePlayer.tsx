import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Download,
  AlertCircle,
  RefreshCw,
  Film,
} from 'lucide-react';
import { getStoredToken } from '../services/api';

interface VideoMessagePlayerProps {
  videoUrl: string;
  thumbnail?: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  isOutgoing?: boolean;
}

export const VideoMessagePlayer: React.FC<VideoMessagePlayerProps> = ({
  videoUrl,
  thumbnail,
  fileName,
  fileSize,
  duration,
  isOutgoing = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(duration || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFullscreenModal, setIsFullscreenModal] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);

  // Authenticated video source URL
  const authenticatedSrc = useMemo(() => {
    if (!videoUrl) return '';
    // If it's already a blob or data URL, return as-is
    if (videoUrl.startsWith('blob:') || videoUrl.startsWith('data:')) {
      return videoUrl;
    }
    const token = getStoredToken();
    if (!token) return videoUrl;
    const separator = videoUrl.includes('?') ? '&' : '?';
    // If token already present, avoid duplicate
    if (videoUrl.includes('token=')) return videoUrl;
    return `${videoUrl}${separator}token=${encodeURIComponent(token)}`;
  }, [videoUrl]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Format bytes to KB or MB
  const formatSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handlePlayClick = () => {
    setHasError(false);
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.error('Video play error:', err);
        setHasError(true);
        setErrorMessage('Unable to play video.');
        setIsPlaying(false);
      });
    }
  };

  const handlePause = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    setIsLoaded(true);
    if (videoRef.current && (!videoDuration || videoDuration === 0)) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const handleError = () => {
    setHasError(true);
    setErrorMessage('Failed to load video stream');
    setIsPlaying(false);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    setErrorMessage('');
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = authenticatedSrc;
    a.download = fileName || 'video.mp4';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative flex flex-col rounded-2xl overflow-hidden shadow-sm border border-slate-700/20 bg-slate-950 w-full max-w-[320px] sm:max-w-[360px]">
      {/* Video Container */}
      <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center overflow-hidden select-none group">
        {/* Actual Video Element */}
        <video
          ref={videoRef}
          src={authenticatedSrc}
          poster={thumbnail}
          playsInline
          controls={isPlaying && !hasError}
          preload="metadata"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
          onError={handleError}
          className={`w-full h-full object-contain ${!isPlaying && thumbnail ? 'hidden' : 'block'}`}
        />

        {/* Thumbnail / Poster Preview (shown before playback starts) */}
        {!isPlaying && !hasError && (
          <div
            onClick={handlePlayClick}
            className="absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center"
          >
            {thumbnail ? (
              <img
                src={thumbnail}
                alt="Video thumbnail"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center text-slate-400">
                <Film className="w-12 h-12 text-slate-500/70 mb-2" />
                <span className="text-xs font-medium text-slate-300 tracking-wide">Video Message</span>
              </div>
            )}

            {/* Gradient Scrim for readable badges */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />

            {/* Centered WhatsApp-style Play Button */}
            <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-900/80 hover:bg-emerald-600 text-white flex items-center justify-center shadow-2xl backdrop-blur-md border border-white/20 transition-all duration-200 transform group-hover:scale-110 active:scale-95">
              <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-white translate-x-0.5 text-white" />
            </div>

            {/* Bottom Info Badges */}
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between pointer-events-none z-10 text-white text-xs font-medium">
              <span className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md flex items-center gap-1">
                <Film className="w-3 h-3 text-emerald-400" />
                {formatTime(videoDuration || duration || 0)}
              </span>
              {fileSize && (
                <span className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md">
                  {formatSize(fileSize)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center z-20">
            <AlertCircle className="w-10 h-10 text-rose-400 mb-2" />
            <p className="text-xs text-rose-200 font-medium mb-3">{errorMessage || 'Unable to play video'}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className={`px-3 py-2 flex items-center justify-between text-xs ${isOutgoing ? 'bg-indigo-950/40 text-indigo-200' : 'bg-slate-900 text-slate-300'}`}>
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <Film className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          <span className="truncate font-medium text-slate-200 text-xs">
            {fileName || 'Video message'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            className="p-1 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Download video"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsFullscreenModal(true)}
            className="p-1 rounded-md hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Watch in full size"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Large Modal Lightbox for Immersive Viewing */}
      {isFullscreenModal && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setIsFullscreenModal(false)}
        >
          {/* Modal Header */}
          <div
            className="w-full max-w-4xl flex items-center justify-between pb-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="font-semibold text-sm truncate max-w-md">
              {fileName || 'Video playback'}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreenModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Large Video in Modal */}
          <div
            className="relative w-full max-w-4xl max-h-[80vh] flex items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={modalVideoRef}
              src={authenticatedSrc}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-[80vh] w-auto h-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
