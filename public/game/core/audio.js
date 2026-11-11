// Procedural sound: every effect is a few oscillators / noise bursts, so there are no audio files.

/** Sound catalogue. Each entry receives the Audio instance and schedules its notes. */
const SOUNDS = {
  jump: a => a.tone(320, 0.16, 'square', 0.05, 380),
  doubleJump: a => a.tone(520, 0.14, 'square', 0.05, 420),
  coin: a => { a.tone(880, 0.08, 'triangle', 0.07); a.tone(1320, 0.12, 'triangle', 0.06, 0, 0.07); },
  checkpoint: a => a.arpeggio([523, 659, 784], 0.15, 'triangle', 0.07, 0.09),
  hurt: a => { a.tone(220, 0.3, 'sawtooth', 0.09, -150); a.noise(0.22, 0.1, 700); },
  stomp: a => { a.tone(180, 0.12, 'square', 0.08, -60); a.tone(480, 0.1, 'square', 0.05, 0, 0.05); },
  fall: a => a.tone(500, 0.5, 'sine', 0.08, -420),
  win: a => a.arpeggio([523, 659, 784, 1047], 0.22, 'triangle', 0.08, 0.13),
  lose: a => a.arpeggio([392, 330, 262, 196], 0.25, 'sawtooth', 0.06, 0.15),
  fuel: a => { a.tone(660, 0.1, 'sine', 0.08); a.tone(990, 0.14, 'sine', 0.08, 0, 0.08); },
  crash: a => { a.noise(0.3, 0.14, 500); a.tone(110, 0.25, 'square', 0.08, -40); },
  nitro: a => { a.noise(0.9, 0.12, 1800); a.tone(120, 0.9, 'sawtooth', 0.06, 500); },
  boom: a => { a.noise(0.45, 0.16, 400); a.tone(90, 0.4, 'sine', 0.1, -50); },
  laser: a => a.tone(900, 0.15, 'square', 0.04, -600),
  whoosh: a => a.noise(0.5, 0.06, 1200),
  warn: a => a.tone(700, 0.08, 'square', 0.03),
  blackHole: a => { a.tone(120, 1, 'sawtooth', 0.1, -100); a.noise(0.8, 0.12, 300); },
  thunder: a => { a.noise(0.7, 0.22, 600); a.tone(70, 0.6, 'sawtooth', 0.1, -30); },
  power: a => a.arpeggio([392, 523, 659, 784, 1047], 0.14, 'sawtooth', 0.06, 0.06),
  shot: a => { a.noise(0.1, 0.1, 3500); a.tone(180, 0.08, 'square', 0.06, -90); },
  enemyShot: a => { a.noise(0.1, 0.08, 2500); a.tone(120, 0.1, 'sawtooth', 0.05, -60); },
  hit: a => a.tone(300, 0.06, 'square', 0.05, -100),
  empty: a => a.tone(200, 0.05, 'square', 0.04),
  ammo: a => { a.tone(700, 0.07, 'square', 0.06); a.tone(1000, 0.08, 'square', 0.06, 0, 0.07); },
  repair: a => a.arpeggio([600, 800, 1000, 1300], 0.1, 'triangle', 0.07, 0.05),
  shield: a => { a.tone(900, 0.15, 'sine', 0.07, -500); a.noise(0.1, 0.05, 3000); },
  arrow: a => a.tone(1100, 0.13, 'sawtooth', 0.03, -700),
  pop: a => { a.tone(300, 0.08, 'square', 0.04, -120); a.noise(0.08, 0.05, 2500); },
  bat: a => { a.tone(1400, 0.1, 'square', 0.03, 600); a.tone(1800, 0.08, 'square', 0.03, -500, 0.09); },
  smash: a => { a.noise(0.25, 0.12, 900); a.tone(160, 0.15, 'square', 0.06, -60); },
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.drone = null; // continuous engine sound used by the vehicle levels
  }

  /** Browsers only allow audio after a user gesture: call this from input handlers. */
  unlock() {
    if (!this.ctx) {
      const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctx) return;
      try { this.ctx = new Ctx(); } catch { return; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.engine(40, 0);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    SOUNDS[name]?.(this);
  }

  tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    const a = this.ctx;
    if (!a || this.muted) return;
    const t = a.currentTime + delay, osc = a.createOscillator(), gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  arpeggio(freqs, dur, type, vol, step) {
    freqs.forEach((f, i) => this.tone(f, dur, type, vol, 0, i * step));
  }

  noise(dur, vol = 0.1, cutoff = 800) {
    const a = this.ctx;
    if (!a || this.muted) return;
    const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(), filter = a.createBiquadFilter(), gain = a.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(vol, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    src.connect(filter).connect(gain).connect(a.destination);
    src.start();
  }

  /** Continuous sawtooth "engine". engine(freq, 0) silences it. */
  engine(freq, vol) {
    const a = this.ctx;
    if (!a) return;
    if (!this.drone) {
      const osc = a.createOscillator(), gain = a.createGain();
      osc.type = 'sawtooth';
      gain.gain.value = 0;
      osc.connect(gain).connect(a.destination);
      osc.start();
      this.drone = { osc, gain };
    }
    this.drone.osc.frequency.setTargetAtTime(Math.max(30, freq), a.currentTime, 0.05);
    this.drone.gain.gain.setTargetAtTime(this.muted ? 0 : vol, a.currentTime, 0.05);
  }
}

/** Drop-in silent implementation (used by tests and before audio is available). */
export const silentAudio = { play() {}, engine() {}, unlock() {}, setMuted() {} };
