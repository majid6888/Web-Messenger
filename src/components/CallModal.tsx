import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  Maximize2,
  Minimize2,
  Volume2,
  Wifi,
} from 'lucide-react';
import { CallSession } from '../types';
import { Avatar } from './Avatar';
import { webrtc } from '../services/webrtc';
import { sounds } from '../services/audio';

interface CallModalProps {
  session: CallSession;
  onAccept: () => void;
  onReject: (reason?: string) => void;
  onEnd: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  session,
  onAccept,
  onReject,
  onEnd,
}) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [remoteCameraOff, setRemoteCameraOff] = useState(false);
  const [remoteMicMuted, setRemoteMicMuted] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canSwitchCamera, setCanSwitchCamera] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<any>(null);

  const isIncoming = !session.isCaller && (session.status === 'calling' || session.status === 'ringing');
  const isOutgoing = session.isCaller && (session.status === 'calling' || session.status === 'ringing');
  const isConnected = session.status === 'connected';

  // Sound effects & duration timer
  useEffect(() => {
    if (isIncoming) {
      sounds.startIncomingRingtone(session.type);
    } else if (isOutgoing) {
      sounds.startDialTone();
    } else if (isConnected) {
      sounds.stopRingtone();
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      sounds.stopRingtone();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session.status, isIncoming, isOutgoing, isConnected]);

  // Robust stream attachment helper for local video
  const attachLocalVideo = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el) {
      el.muted = true; // Never feedback own audio
      el.setAttribute('playsinline', 'true');
      const stream = webrtc.getLocalStream();
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.play().catch(() => {});
    }
  }, []);

  // Robust stream attachment helper for remote video
  const attachRemoteVideo = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el) {
      el.setAttribute('playsinline', 'true');
      const stream = webrtc.getRemoteStream();
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
      }
      el.play().catch(() => {});
    }
  }, []);

  // Set up WebRTC callbacks & handle live tracks
  useEffect(() => {
    webrtc.setCallbacks(
      (localStream) => {
        if (localVideoRef.current && localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
          localVideoRef.current.play().catch(() => {});
        }
      },
      (remoteStream) => {
        if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
        const vTrack = remoteStream.getVideoTracks()[0];
        if (vTrack) {
          setRemoteCameraOff(!vTrack.enabled || vTrack.readyState === 'ended');
        }
      },
      (state) => {
        setConnectionState(state);
      },
      (mediaState) => {
        if (typeof mediaState.cameraOff === 'boolean') {
          setRemoteCameraOff(mediaState.cameraOff);
        }
        if (typeof mediaState.micMuted === 'boolean') {
          setRemoteMicMuted(mediaState.micMuted);
        }
      }
    );

    // Initial check to attach streams if available
    const local = webrtc.getLocalStream();
    if (local && localVideoRef.current && localVideoRef.current.srcObject !== local) {
      localVideoRef.current.srcObject = local;
      localVideoRef.current.play().catch(() => {});
    }
    const remote = webrtc.getRemoteStream();
    if (remote && remoteVideoRef.current && remoteVideoRef.current.srcObject !== remote) {
      remoteVideoRef.current.srcObject = remote;
      remoteVideoRef.current.play().catch(() => {});
    }

    setCanSwitchCamera(webrtc.getAvailableCamerasCount() > 1);
  }, [isConnected]);

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    webrtc.toggleMuteMic(nextMuted);
    setIsMuted(nextMuted);
  };

  const handleToggleCamera = () => {
    const nextOff = !cameraOff;
    webrtc.toggleCamera(!nextOff);
    setCameraOff(nextOff);
  };

  const handleSwitchCamera = async () => {
    await webrtc.switchCamera();
  };

  const toggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!document.fullscreenElement) {
      modalContainerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Participant resolution
  const partnerName = session.isCaller ? session.receiverName : session.callerName;
  const partnerAvatar = session.isCaller ? session.receiverAvatar : session.callerAvatar;
  const selfName = session.isCaller ? session.callerName : session.receiverName;
  const selfAvatar = session.isCaller ? session.callerAvatar : session.receiverAvatar;

  return (
    <div
      id="call-modal-overlay"
      ref={modalContainerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-3 sm:p-6 select-none"
    >
      <div className="relative w-full max-w-4xl h-[88vh] max-h-[760px] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header Bar */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent pointer-events-auto">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              {session.type === 'video' ? 'WebRTC Video Call' : 'WebRTC Voice Call'}
            </span>
            {isConnected && connectionState !== 'connected' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {connectionState}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isConnected && (
              <span className="text-sm font-semibold text-slate-100 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60 tabular-nums shadow-xs">
                {formatDuration(duration)}
              </span>
            )}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Call Main Canvas */}
        <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden bg-slate-950">
          {session.type === 'video' && isConnected ? (
            /* ========================================================================= */
            /* CONNECTED VIDEO LAYOUT: Large Remote Video + Small Floating Self-Preview  */
            /* ========================================================================= */
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden">
              {/* 1. LARGE REMOTE VIDEO (MAIN) */}
              <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                <video
                  ref={attachRemoteVideo}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    remoteCameraOff ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                />

                {/* Remote Camera Off Placeholder */}
                {remoteCameraOff && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-radial from-slate-900 via-slate-950 to-black">
                    <div className="relative mb-4">
                      <Avatar name={partnerName} avatarUrl={partnerAvatar} size="3xl" />
                      <div className="absolute -bottom-1 -right-1 p-2 rounded-full bg-slate-800 border-2 border-slate-900 text-amber-400 shadow-md">
                        <VideoOff className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">
                      {partnerName}
                    </h3>
                    <p className="text-sm font-medium text-slate-400 flex items-center gap-1.5">
                      <VideoOff className="w-4 h-4 text-slate-500" />
                      Camera is turned off
                    </p>
                  </div>
                )}

                {/* Remote participant tag overlay */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-xs font-semibold shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="truncate max-w-[140px]">{partnerName}</span>
                  {remoteMicMuted && (
                    <span className="text-red-400 flex items-center gap-0.5 ml-1" title="Microphone muted">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* 2. SMALL FLOATING SELF-PREVIEW BOX (CORNER) */}
              <div
                id="local-video-preview"
                className="absolute bottom-24 right-4 sm:bottom-28 sm:right-6 w-32 h-44 sm:w-44 sm:h-60 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900 z-30 group ring-1 ring-black/40"
              >
                <video
                  ref={attachLocalVideo}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${
                    cameraOff ? 'opacity-0 pointer-events-none' : 'opacity-100'
                  }`}
                />

                {/* Local Camera Off Placeholder */}
                {cameraOff && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-slate-800">
                    <Avatar name={selfName} avatarUrl={selfAvatar} size="md" />
                    <span className="text-[11px] font-semibold text-slate-300 mt-2">
                      Camera off
                    </span>
                  </div>
                )}

                {/* Self Tag */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] font-bold text-white tracking-wider uppercase border border-white/10">
                  You
                </div>

                {isMuted && (
                  <div
                    className="absolute top-2 right-2 p-1 rounded-md bg-red-600/90 text-white"
                    title="You are muted"
                  >
                    <MicOff className="w-3 h-3" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* INCOMING CALL, OUTGOING CALL, OR VOICE CALL SCREEN                        */
            /* ========================================================================= */
            <div className="flex flex-col items-center text-center px-4 py-8 z-10">
              {/* Partner Avatar with animated status rings */}
              <div className="relative mb-6">
                {(isIncoming || isOutgoing) && (
                  <>
                    <div className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping duration-1000" />
                    <div className="absolute -inset-8 rounded-full bg-indigo-500/15 animate-pulse duration-700" />
                  </>
                )}
                <div className="relative rounded-full shadow-2xl ring-4 ring-indigo-500/40">
                  <Avatar name={partnerName} avatarUrl={partnerAvatar} size="3xl" />
                </div>
              </div>

              {/* Status Header */}
              {isIncoming ? (
                <div className="space-y-1 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold uppercase tracking-wider border border-emerald-500/20">
                    {session.type === 'video' ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                    Incoming {session.type === 'video' ? 'video' : 'voice'} call
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight pt-2">
                    {partnerName} is calling you
                  </h2>
                </div>
              ) : isOutgoing ? (
                <div className="space-y-1 mb-2">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {partnerName}
                  </h2>
                  <p className="text-sm font-medium text-indigo-400">
                    Calling {session.type === 'video' ? 'video' : 'voice'}...
                  </p>
                </div>
              ) : (
                <div className="space-y-1 mb-2">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    {partnerName}
                  </h2>
                  <p className="text-sm font-medium text-emerald-400">
                    Voice Call Connected ({formatDuration(duration)})
                  </p>
                </div>
              )}

              {isConnected && (
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-4 bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700/60">
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Encrypted Peer-to-Peer Audio</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Controls Bar */}
        <div className="p-4 sm:p-6 bg-slate-900/95 border-t border-slate-800/80 flex items-center justify-center gap-4 sm:gap-6 z-30">
          {/* 1. Incoming Call Buttons: [Accept] [Decline] */}
          {isIncoming ? (
            <div className="flex items-center gap-10">
              {/* Decline Button */}
              <button
                id="call-decline-btn"
                type="button"
                onClick={() => onReject('declined')}
                className="group flex flex-col items-center gap-2 focus:outline-hidden"
              >
                <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all transform active:scale-95 group-hover:scale-105">
                  <PhoneOff className="w-7 h-7" />
                </div>
                <span className="text-xs font-semibold text-slate-300">Decline</span>
              </button>

              {/* Accept Button */}
              <button
                id="call-accept-btn"
                type="button"
                onClick={onAccept}
                className="group flex flex-col items-center gap-2 focus:outline-hidden"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all transform active:scale-95 group-hover:scale-105 animate-bounce">
                  {session.type === 'video' ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
                </div>
                <span className="text-xs font-semibold text-emerald-400">Accept</span>
              </button>
            </div>
          ) : (
            /* 2. Connected or Outgoing Controls */
            <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-center">
              {/* Mute/Unmute Mic */}
              <button
                id="call-toggle-mic-btn"
                type="button"
                onClick={handleToggleMute}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-xs ${
                  isMuted
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Camera Toggle (Video Call Only) */}
              {session.type === 'video' && (
                <>
                  <button
                    id="call-toggle-camera-btn"
                    type="button"
                    onClick={handleToggleCamera}
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors shadow-xs ${
                      cameraOff
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                    title={cameraOff ? 'Turn camera on' : 'Turn camera off'}
                  >
                    {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </button>

                  {/* Switch Camera if available */}
                  {canSwitchCamera && (
                    <button
                      id="call-switch-camera-btn"
                      type="button"
                      onClick={handleSwitchCamera}
                      className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition-colors shadow-xs"
                      title="Switch camera"
                    >
                      <SwitchCamera className="w-5 h-5" />
                    </button>
                  )}
                </>
              )}

              {/* End Call Button */}
              <button
                id="call-end-btn"
                type="button"
                onClick={onEnd}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all transform active:scale-95 hover:scale-105"
                title="End call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
