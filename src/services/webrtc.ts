import { socket } from './socket';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCallId: string | null = null;
  private targetUserId: string | null = null;
  private myUserId: string | null = null;
  private isVideoCall = false;
  private currentCameraIndex = 0;
  private videoDevices: MediaDeviceInfo[] = [];
  private pendingCandidates: RTCIceCandidateInit[] = [];

  private onLocalStreamCb: ((stream: MediaStream) => void) | null = null;
  private onRemoteStreamCb: ((stream: MediaStream) => void) | null = null;
  private onConnectionStateCb: ((state: RTCPeerConnectionState) => void) | null = null;
  private onRemoteMediaStateCb: ((state: { cameraOff?: boolean; micMuted?: boolean }) => void) | null = null;

  public setUserId(userId: string) {
    this.myUserId = userId;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  async initLocalMedia(video: boolean, myUserId?: string): Promise<MediaStream> {
    this.isVideoCall = video;
    if (myUserId) {
      this.myUserId = myUserId;
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        this.videoDevices = devices.filter((d) => d.kind === 'videoinput');
      }
    } catch {}

    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: video
        ? {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user',
          }
        : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.onLocalStreamCb) {
        this.onLocalStreamCb(this.localStream);
      }
      return this.localStream;
    } catch (err) {
      console.warn('Could not get full media constraints, attempting fallback:', err);
      try {
        // Fallback: try standard video or audio only
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: video ? true : false,
        });
        if (this.onLocalStreamCb) {
          this.onLocalStreamCb(this.localStream);
        }
        return this.localStream;
      } catch (fallbackErr) {
        console.warn('Fallback to audio only due to:', fallbackErr);
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (this.onLocalStreamCb) {
          this.onLocalStreamCb(this.localStream);
        }
        return this.localStream;
      }
    }
  }

  private setupPeerConnection() {
    this.cleanupPeerConnection();

    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
    this.remoteStream = new MediaStream();

    if (this.onRemoteStreamCb) {
      this.onRemoteStreamCb(this.remoteStream);
    }

    // Add local tracks to peer connection
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        this.peerConnection.addTrack(track, this.localStream);
      }
    }

    // Handle remote tracks arriving from peer
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else if (this.remoteStream) {
        this.remoteStream.addTrack(event.track);
      }

      if (this.onRemoteStreamCb && this.remoteStream) {
        this.onRemoteStreamCb(this.remoteStream);
      }

      // Track mute/unmute events
      if (event.track.kind === 'video') {
        event.track.onmute = () => {
          this.onRemoteMediaStateCb?.({ cameraOff: true });
        };
        event.track.onunmute = () => {
          this.onRemoteMediaStateCb?.({ cameraOff: false });
        };
        event.track.onended = () => {
          this.onRemoteMediaStateCb?.({ cameraOff: true });
        };
      }
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentCallId && this.targetUserId) {
        socket.send({
          type: 'webrtc:ice-candidate',
          payload: {
            callId: this.currentCallId,
            targetUserId: this.targetUserId,
            senderId: this.myUserId,
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection && this.onConnectionStateCb) {
        this.onConnectionStateCb(this.peerConnection.connectionState);
      }
    };
  }

  // Caller initiates offer to target user
  async createOffer(callId: string, targetUserId: string, myUserId?: string) {
    this.currentCallId = callId;
    this.targetUserId = targetUserId;
    if (myUserId) {
      this.myUserId = myUserId;
    }

    this.setupPeerConnection();
    if (!this.peerConnection) return;

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.isVideoCall,
    });

    await this.peerConnection.setLocalDescription(offer);

    socket.send({
      type: 'webrtc:offer',
      payload: {
        callId,
        targetUserId,
        senderId: this.myUserId,
        sdp: offer,
      },
    });
  }

  // Receiver handles offer and creates answer back to caller
  async handleOffer(
    callId: string,
    callerId: string,
    sdp: RTCSessionDescriptionInit,
    myUserId?: string
  ) {
    this.currentCallId = callId;
    this.targetUserId = callerId;
    if (myUserId) {
      this.myUserId = myUserId;
    }

    this.setupPeerConnection();
    if (!this.peerConnection) return;

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

    // Process any queued ICE candidates that arrived before remote description
    while (this.pendingCandidates.length > 0) {
      const cand = this.pendingCandidates.shift();
      if (cand) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('Error adding queued candidate:', e);
        }
      }
    }

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    socket.send({
      type: 'webrtc:answer',
      payload: {
        callId,
        targetUserId: callerId,
        senderId: this.myUserId,
        sdp: answer,
      },
    });
  }

  // Caller handles answer from receiver
  async handleAnswer(sdp: RTCSessionDescriptionInit) {
    if (this.peerConnection) {
      try {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

        // Flush any queued candidates
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          if (cand) {
            try {
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('Error adding queued candidate:', e);
            }
          }
        }
      } catch (err) {
        console.warn('Error setting remote description from answer:', err);
      }
    }
  }

  // Handle incoming ICE candidate
  async handleCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate) return;

    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Error adding ICE candidate:', err);
      }
    } else {
      // Queue candidate until remote description is set
      this.pendingCandidates.push(candidate);
    }
  }

  // Handle remote media state event (camera toggle, mic toggle)
  handleRemoteMediaState(payload: { cameraOff?: boolean; micMuted?: boolean }) {
    if (this.onRemoteMediaStateCb) {
      this.onRemoteMediaStateCb(payload);
    }
  }

  // Register callbacks. If streams already exist, immediately invoke callbacks!
  setCallbacks(
    onLocalStream: (stream: MediaStream) => void,
    onRemoteStream: (stream: MediaStream) => void,
    onConnectionState?: (state: RTCPeerConnectionState) => void,
    onRemoteMediaState?: (state: { cameraOff?: boolean; micMuted?: boolean }) => void
  ) {
    this.onLocalStreamCb = onLocalStream;
    this.onRemoteStreamCb = onRemoteStream;
    if (onConnectionState) {
      this.onConnectionStateCb = onConnectionState;
    }
    if (onRemoteMediaState) {
      this.onRemoteMediaStateCb = onRemoteMediaState;
    }

    // Immediately replay streams if already available
    if (this.localStream) {
      onLocalStream(this.localStream);
    }
    if (this.remoteStream && this.remoteStream.getTracks().length > 0) {
      onRemoteStream(this.remoteStream);
    }
    if (this.peerConnection && onConnectionState) {
      onConnectionState(this.peerConnection.connectionState);
    }
  }

  // Audio Controls
  toggleMuteMic(muted: boolean): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !muted;

      // Broadcast media state update to peer
      if (this.currentCallId && this.targetUserId) {
        socket.send({
          type: 'call:media-state',
          payload: {
            callId: this.currentCallId,
            targetUserId: this.targetUserId,
            senderId: this.myUserId,
            micMuted: muted,
          },
        });
      }
      return audioTrack.enabled;
    }
    return false;
  }

  // Video Controls
  toggleCamera(enabled: boolean): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = enabled;

      // Broadcast media state update to peer
      if (this.currentCallId && this.targetUserId) {
        socket.send({
          type: 'call:media-state',
          payload: {
            callId: this.currentCallId,
            targetUserId: this.targetUserId,
            senderId: this.myUserId,
            cameraOff: !enabled,
          },
        });
      }
      return videoTrack.enabled;
    }
    return false;
  }

  // Switch camera (front/back or alternate webcam)
  async switchCamera(): Promise<boolean> {
    if (!this.isVideoCall || this.videoDevices.length < 2 || !this.peerConnection) {
      return false;
    }

    this.currentCameraIndex = (this.currentCameraIndex + 1) % this.videoDevices.length;
    const nextDevice = this.videoDevices[this.currentCameraIndex];

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: nextDevice.deviceId } },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const sender = this.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');

      if (sender && newVideoTrack) {
        await sender.replaceTrack(newVideoTrack);

        const oldTrack = this.localStream?.getVideoTracks()[0];
        if (oldTrack) {
          oldTrack.stop();
          this.localStream?.removeTrack(oldTrack);
        }
        this.localStream?.addTrack(newVideoTrack);

        if (this.onLocalStreamCb && this.localStream) {
          this.onLocalStreamCb(this.localStream);
        }
        return true;
      }
    } catch (e) {
      console.warn('Could not switch camera:', e);
    }
    return false;
  }

  getAvailableCamerasCount(): number {
    return this.videoDevices.length;
  }

  private cleanupPeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      try {
        this.peerConnection.close();
      } catch {}
      this.peerConnection = null;
    }
    this.pendingCandidates = [];
  }

  cleanup() {
    this.cleanupPeerConnection();

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        try {
          track.stop();
        } catch {}
      }
      this.localStream = null;
    }

    this.remoteStream = null;
    this.currentCallId = null;
    this.targetUserId = null;
    this.onLocalStreamCb = null;
    this.onRemoteStreamCb = null;
    this.onConnectionStateCb = null;
    this.onRemoteMediaStateCb = null;
  }
}

export const webrtc = new WebRTCManager();
