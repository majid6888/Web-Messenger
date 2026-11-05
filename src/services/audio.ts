// Web Audio API tone generator with loud, rich harmonic ringtones, dial tones, and custom message chimes

export type RingtonePreset = 'classic_loud' | 'modern_marimba' | 'digital_ring';
export type MessageTonePreset = 'whatsapp_chime' | 'marimba_ding' | 'crystal_pop' | 'radar_ping';

class SoundEffects {
  private ctx: AudioContext | null = null;
  private ringInterval: any = null;
  private activeOscs: OscillatorNode[] = [];
  private volume: number = 0.9;
  private ringtonePreset: RingtonePreset = 'classic_loud';
  private messageTonePreset: MessageTonePreset = 'whatsapp_chime';

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const savedVol = localStorage.getItem('wm_sound_volume');
        if (savedVol !== null) {
          const parsed = parseFloat(savedVol);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            this.volume = parsed;
          }
        }
        const savedRing = localStorage.getItem('wm_ringtone_preset') as RingtonePreset;
        if (savedRing && ['classic_loud', 'modern_marimba', 'digital_ring'].includes(savedRing)) {
          this.ringtonePreset = savedRing;
        }
        const savedMsg = localStorage.getItem('wm_message_tone_preset') as MessageTonePreset;
        if (savedMsg && ['whatsapp_chime', 'marimba_ding', 'crystal_pop', 'radar_ping'].includes(savedMsg)) {
          this.messageTonePreset = savedMsg;
        }
      } catch {}
    }
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('wm_sound_volume', this.volume.toString());
    } catch {}
  }

  public getRingtonePreset(): RingtonePreset {
    return this.ringtonePreset;
  }

  public setRingtonePreset(preset: RingtonePreset) {
    this.ringtonePreset = preset;
    try {
      localStorage.setItem('wm_ringtone_preset', preset);
    } catch {}
  }

  public getMessageTonePreset(): MessageTonePreset {
    return this.messageTonePreset;
  }

  public setMessageTonePreset(preset: MessageTonePreset) {
    this.messageTonePreset = preset;
    try {
      localStorage.setItem('wm_message_tone_preset', preset);
    } catch {}
  }

  // Play outgoing telephone dial tone
  startDialTone() {
    this.stopRingtone();
    try {
      const ctx = this.getContext();
      const playPulse = () => {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Standard US/UK telephone dial combination: 440Hz + 480Hz
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        const targetGain = 0.25 * this.volume;
        gain.gain.setValueAtTime(targetGain, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      };

      playPulse();
      this.ringInterval = setInterval(playPulse, 3200);
    } catch (e) {
      console.warn('Audio play prevented by browser policy:', e);
    }
  }

  // Loud, crystal-clear repeating incoming ringtone
  startIncomingRingtone(callType: 'voice' | 'video' = 'voice') {
    this.stopRingtone();
    try {
      const ctx = this.getContext();
      const masterVol = Math.max(0.2, this.volume);

      const playRingCycle = () => {
        const now = ctx.currentTime;

        if (this.ringtonePreset === 'classic_loud' || callType === 'voice') {
          // Classic High-Volume Dual Harmonic Bell (Telephone Ring)
          const burst = (offset: number) => {
            const t = now + offset;
            const oscA = ctx.createOscillator();
            const oscB = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscA.type = 'sine';
            oscA.frequency.setValueAtTime(480, t);
            oscB.type = 'sine';
            oscB.frequency.setValueAtTime(440, t);

            // Loud envelope
            gainNode.gain.setValueAtTime(0.7 * masterVol, t);
            gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

            oscA.connect(gainNode);
            oscB.connect(gainNode);
            gainNode.connect(ctx.destination);

            oscA.start(t);
            oscB.start(t);
            oscA.stop(t + 0.9);
            oscB.stop(t + 0.9);
          };

          burst(0.0);
          burst(1.1);
        } else if (this.ringtonePreset === 'modern_marimba' || callType === 'video') {
          // Modern Bright Video Call Melody (C5 -> E5 -> G5 -> C6)
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const t = now + idx * 0.18;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.65 * masterVol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.5);
          });
        } else {
          // Digital Pulse Ring
          [880, 1174.66, 880, 1174.66].forEach((freq, idx) => {
            const t = now + idx * 0.14;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, t);

            gain.gain.setValueAtTime(0.4 * masterVol, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.12);
          });
        }
      };

      playRingCycle();
      this.ringInterval = setInterval(playRingCycle, 2800);
    } catch (e) {
      console.warn('Audio ringtone prevented:', e);
    }
  }

  stopRingtone() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    this.activeOscs.forEach((osc) => {
      try {
        osc.stop();
      } catch {}
    });
    this.activeOscs = [];
  }

  // Play distinctive incoming message sound (Loud & Clear)
  playMessageReceived(type?: 'text' | 'image' | 'video' | 'voice' | 'file') {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const vol = Math.max(0.15, this.volume);

      if (this.messageTonePreset === 'whatsapp_chime' || !this.messageTonePreset) {
        // Bright WhatsApp-style signature two-tone chime
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        const gain2 = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(784.0, now); // G5
        gain1.gain.setValueAtTime(0.65 * vol, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.5, now + 0.08); // C6
        gain2.gain.setValueAtTime(0.7 * vol, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.18);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.35);
      } else if (this.messageTonePreset === 'crystal_pop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.12);
        gain.gain.setValueAtTime(0.75 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (this.messageTonePreset === 'marimba_ding') {
        [587.33, 880, 1174.66].forEach((f, idx) => {
          const t = now + idx * 0.06;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, t);
          gain.gain.setValueAtTime(0.6 * vol, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.25);
        });
      } else {
        // Radar Ping
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        gain.gain.setValueAtTime(0.6 * vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (e) {
      console.warn('Audio message chime prevented:', e);
    }
  }

  // Crisp audio click for sent messages
  playMessageSent() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880.0, now);
      osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.06);

      gain.gain.setValueAtTime(0.3 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {}
  }

  // Voice record start beep
  playRecordStart() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(1046.5, now + 0.07);

      gain.gain.setValueAtTime(0.4 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  // Quick tone preview for settings modal
  previewRingtone(preset: RingtonePreset) {
    this.stopRingtone();
    const prev = this.ringtonePreset;
    this.ringtonePreset = preset;
    this.startIncomingRingtone('voice');
    setTimeout(() => {
      this.stopRingtone();
      this.ringtonePreset = prev;
    }, 2400);
  }

  previewMessageTone(preset: MessageTonePreset) {
    const prev = this.messageTonePreset;
    this.messageTonePreset = preset;
    this.playMessageReceived('text');
    this.messageTonePreset = prev;
  }
}

export const sounds = new SoundEffects();
