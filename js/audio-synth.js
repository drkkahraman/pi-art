/**
 * Web Audio Synthesizer for Pi Digit Sonification
 */

class PiSynthesizer {
  constructor() {
    this.ctx = null;
    this.isEnabled = false;
    this.volume = 0.15;
    
    // Pentatonic scale frequencies in C Major / A Minor: C4, D4, E4, G4, A4, C5, D5, E5, G5, A5
    this.scale = [
      261.63, // 0 -> C4
      293.66, // 1 -> D4
      329.63, // 2 -> E4
      392.00, // 3 -> G4
      440.00, // 4 -> A4
      523.25, // 5 -> C5
      587.33, // 6 -> D5
      659.25, // 7 -> E5
      783.99, // 8 -> G5
      880.00  // 9 -> A5
    ];

    this.masterGain = null;
    this.reverbNode = null;
    this.isInitialized = false;
  }

  init() {
    if (this.isInitialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.isInitialized = true;
    } catch (e) {
      console.warn("AudioContext not supported or blocked", e);
    }
  }

  toggle() {
    if (!this.isInitialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  playDigit(digit) {
    if (!this.isEnabled || !this.ctx || this.ctx.state !== 'running') return;
    
    const freq = this.scale[digit] || 440;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();

    // Soft sine/triangle tone for calming ambient aesthetic
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // ADSR envelope
    noteGain.gain.setValueAtTime(0.001, now);
    noteGain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(noteGain);
    noteGain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.25);
  }
}

window.PiSynthesizer = PiSynthesizer;
