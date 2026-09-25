// Procedural sound for the stories: warning hooter, thunder, rain, alarm tones.
// Everything is synthesised with WebAudio (no sound files, so the page stays
// offline-capable). Browsers only allow audio after a user gesture, so the
// context is created lazily on the first click or key press.

export class SoundEngine {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.hooter = null;
    this.rain = null;
    const unlock = () => {
      this.ensure();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    this.noiseBuf = this.makeNoise(4);
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }

  /** Brown-ish noise buffer, shared by thunder and rain. */
  makeNoise(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.035 * white) / 1.035;
      d[i] = last * 3.2 + white * 0.08;
    }
    return buf;
  }

  // -- hooter: two-tone electronic siren, loudness falls with distance -------
  startHooter() {
    const ctx = this.ensure();
    if (!ctx || this.hooter) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    const g2 = ctx.createGain();
    g2.gain.value = 0.25;
    // Slow wail between 560 and 1080 Hz, the classic hooter sweep.
    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = 0.42;
    const depth = ctx.createGain();
    depth.gain.value = 260;
    osc.frequency.value = 820;
    osc2.frequency.value = 820;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    depth.connect(osc2.frequency);
    osc.connect(filter);
    osc2.connect(g2).connect(filter);
    filter.connect(out).connect(this.master);
    osc.start(); osc2.start(); lfo.start();
    this.hooter = { out, nodes: [osc, osc2, lfo] };
  }

  /** 0..1 loudness, already distance-attenuated by the caller. */
  setHooterLevel(level) {
    if (!this.hooter) return;
    this.hooter.out.gain.setTargetAtTime(0.16 * level, this.ctx.currentTime, 0.08);
  }

  stopHooter() {
    if (!this.hooter) return;
    const { out, nodes } = this.hooter;
    out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } }), 900);
    this.hooter = null;
  }

  // -- thunder: arrives distance / 343 m/s after the flash -------------------
  thunder(distance, delaySeconds) {
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySeconds;
    const near = Math.max(0, 1 - distance / 900);
    // Close strikes crack; far ones only rumble (high frequencies are absorbed
    // by the air over distance).
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300 + near * 2600, t0);
    lp.frequency.exponentialRampToValueAtTime(120, t0 + 3.5);
    const g = ctx.createGain();
    const peak = 0.35 + near * 0.65;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.03 + (1 - near) * 0.25);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t0 + 1.2);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 4.2);
    src.connect(lp).connect(g).connect(this.master);
    src.start(t0, Math.random() * 1.5, 4.5);
  }

  // -- rain: filtered noise bed, level follows rain intensity ----------------
  setRain(level) {
    if (!this.ctx && level <= 0.01) return;   // don't create audio before it's needed
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.rain && level > 0.01) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(hp).connect(g).connect(this.master);
      src.start();
      this.rain = { src, g };
    }
    if (this.rain) this.rain.g.gain.setTargetAtTime(0.05 * level, ctx.currentTime, 0.4);
  }

  /** Short alarm pattern: 'alert' (intrusion), 'notify' (tablet), 'lock' (tracking). */
  beep(kind = 'notify') {
    const ctx = this.ensure();
    if (!ctx) return;
    const patterns = {
      notify: [[880, 0, 0.09], [1320, 0.12, 0.12]],
      alert: [[1200, 0, 0.14], [900, 0.18, 0.14], [1200, 0.36, 0.14], [900, 0.54, 0.14]],
      lock: [[660, 0, 0.06], [990, 0.08, 0.06], [1320, 0.16, 0.1]],
    };
    const now = ctx.currentTime;
    for (const [f, at, dur] of patterns[kind] || patterns.notify) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + at);
      g.gain.linearRampToValueAtTime(0.06, now + at + 0.01);
      g.gain.setValueAtTime(0.06, now + at + dur - 0.02);
      g.gain.linearRampToValueAtTime(0, now + at + dur);
      o.connect(g).connect(this.master);
      o.start(now + at);
      o.stop(now + at + dur + 0.02);
    }
  }

  stopAll() {
    this.stopHooter();
    this.setRain(0);
  }
}
