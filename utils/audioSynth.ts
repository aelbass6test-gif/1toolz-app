/**
 * Custom Audio Synthesizer and Voice Simulation API
 * Powered by Web Audio API and Web Speech synthesis for Arabic-vocal interactive feedback.
 */

class AudioSynthEngine {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Play synthetically rendered tones using oscillators (Custom Synthesizer)
   */
  public playTone(type: 'success' | 'warning' | 'error' | 'click' | 'info' | 'chime') {
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      if (type === 'click') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } 
      else if (type === 'success' || type === 'chime') {
        // تأكيد النجاح (Success / sine @ 587.33Hz ثم 880Hz)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.16);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.12);
        gain2.gain.setValueAtTime(0, now + 0.12);
        gain2.gain.linearRampToValueAtTime(0.12, now + 0.14);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.4);
      } 
      else if (type === 'warning') {
        // نداء التحذير (Warning / triangle @ 440Hz)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } 
      else if (type === 'error') {
        // إنذار الخطأ (Error / sawtooth @ 180Hz)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      }
      else if (type === 'info') {
        // إعلامات عامة (Info / sine @ 523.25Hz)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      console.warn("Failed to generate synthetic sound tone: ", e);
    }
  }

  /**
   * Speak Arabic narration phrases using the system Text-to-Speech synthesizer
   */
  public speak(text: string) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      // Cancel previous speak streams to respond instantly
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-EG'; // Aim for Egyptian Arabic / general Arabic
      utterance.rate = 1.05; // Slightly swifter
      utterance.pitch = 1.0;
      
      // Select best Arabic speech voice if loaded
      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find(v => v.lang.includes('ar') || v.name.toLowerCase().includes('arabic'));
      if (arVoice) {
        utterance.voice = arVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech Synthesis synthesis failed", e);
    }
  }

  /**
   * Integrated alert: Sound first, then speak
   */
  public announce(text: string, toneType: 'success' | 'warning' | 'error' | 'click' | 'info' = 'info') {
    this.playTone(toneType);
    this.speak(text);
  }
}

export const audioSynth = new AudioSynthEngine();
