import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, Mic } from 'lucide-react';

interface VoiceMessagePlayerProps {
  mediaUrl: string;
  mediaDuration?: number;
  isOutgoing?: boolean;
}

// Convert base64 data URLs to clean Blob URLs so that HTMLAudioElement can seek and stream reliably
function createPlayableAudioUrl(url: string): { src: string; cleanup?: () => void } {
  if (!url) return { src: '' };

  if (url.startsWith('data:audio/')) {
    try {
      const commaIdx = url.indexOf(',');
      if (commaIdx !== -1) {
        const meta = url.substring(0, commaIdx);
        const base64Data = url.substring(commaIdx + 1);
        const mimeMatch = meta.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';

        const binary = atob(base64Data);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: mimeType });
        const objectUrl = URL.createObjectURL(blob);
        return {
          src: objectUrl,
          cleanup: () => URL.revokeObjectURL(objectUrl),
        };
      }
    } catch (err) {
      console.warn('Could not create Blob URL for audio, falling back to direct data URL:', err);
    }
  }

  return { src: url };
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  mediaUrl,
  mediaDuration = 0,
  isOutgoing = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(() => Math.max(1, mediaDuration || 0));
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Derive stable playable audio URL
  const { playableUrl, cleanup } = useMemo(() => {
    const res = createPlayableAudioUrl(mediaUrl);
    return { playableUrl: res.src, cleanup: res.cleanup };
  }, [mediaUrl]);

  useEffect(() => {
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [cleanup]);

  // Update duration when mediaDuration prop changes
  useEffect(() => {
    if (mediaDuration && mediaDuration > 0) {
      setDuration((prev) => (prev <= 1 ? mediaDuration : prev));
    }
  }, [mediaDuration]);

  // Handle Play/Pause
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // If at or near the end, restart from beginning
      if (audio.ended || (duration > 0 && currentTime >= duration - 0.3)) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }

      setHasError(false);
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((e) => {
          console.warn('Audio playback was prevented or failed:', e?.message || 'Playback blocked');
          setIsPlaying(false);
          setHasError(true);
        });
    }
  };

  // Handle manual seeking on progress bar
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Waveform visualization bar heights
  const totalBars = 26;
  const waveformHeights = [
    30, 50, 40, 75, 95, 65, 45, 80, 100, 60, 35, 70, 90, 80, 55, 40, 65, 90,
    75, 55, 35, 60, 80, 85, 60, 40
  ];

  return (
    <div
      className={`flex flex-col p-2.5 rounded-2xl select-none w-72 max-w-full space-y-1.5 ${
        isOutgoing
          ? 'bg-emerald-700/10 text-slate-900 border border-emerald-600/15'
          : 'bg-slate-50 text-slate-800 border border-slate-200/80'
      }`}
    >
      {/* Hidden Audio Element with robust event listeners */}
      {playableUrl && (
        <audio
          ref={audioRef}
          src={playableUrl}
          preload="auto"
          onLoadedMetadata={() => {
            const audio = audioRef.current;
            if (audio && isFinite(audio.duration) && audio.duration > 0) {
              setDuration(Math.round(audio.duration));
            }
          }}
          onDurationChange={() => {
            const audio = audioRef.current;
            if (audio && isFinite(audio.duration) && audio.duration > 0) {
              setDuration(Math.round(audio.duration));
            }
          }}
          onTimeUpdate={() => {
            const audio = audioRef.current;
            if (audio) {
              setCurrentTime(audio.currentTime);
              // Handle WebM stream where duration was initially Infinity
              if (isFinite(audio.duration) && audio.duration > 0) {
                setDuration(Math.round(audio.duration));
              } else if (audio.currentTime > duration) {
                setDuration(Math.ceil(audio.currentTime));
              }
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            console.warn('Audio tag encountered a playback/load error');
            setIsPlaying(false);
            setHasError(true);
          }}
        />
      )}

      {/* Voice Message Header Tag */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-0.5">
        <span className="flex items-center gap-1 text-emerald-800">
          <Mic className="w-3.5 h-3.5 text-emerald-600" />
          <span>Voice message</span>
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Player Controls & Waveform */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-sm cursor-pointer ${
            isOutgoing
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
          aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform Bar Seek Container */}
        <div className="flex-1 min-w-0">
          <div className="relative flex items-center h-8 gap-0.5 cursor-pointer group">
            {waveformHeights.slice(0, totalBars).map((height, i) => {
              const barProgress = (i / totalBars) * 100;
              const isFilled = progressPercent >= barProgress;
              return (
                <span
                  key={i}
                  style={{ height: `${height}%` }}
                  className={`flex-1 rounded-full transition-colors duration-150 ${
                    isFilled
                      ? 'bg-emerald-600'
                      : isOutgoing
                      ? 'bg-emerald-200'
                      : 'bg-slate-200'
                  }`}
                />
              );
            })}
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Seek voice message"
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 mt-0.5">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3 h-3 opacity-60 text-slate-400" />
              <span>{isPlaying ? 'Playing' : 'Audio'}</span>
            </span>
            {hasError && <span className="text-red-500 text-[10px]">Error playing audio</span>}
          </div>
        </div>
      </div>
    </div>
  );
};
