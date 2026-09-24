// Synthetic demonstration state. Nothing here is a measurement, a threshold or
// a claimed capability — it exists so the interface has something live to show.

import { LDN_NODES, SQUAD, DETECTIONS, GEOFENCE } from './layout.js';
import { makeRng } from './scene/noise.js';

const rng = makeRng(20260101);

export const LEVELS = ['NORMAL', 'CAUTION', 'ALERT'];

export class Simulation {
  constructor() {
    this.time = 0;
    this.level = 'NORMAL';
    this.autoSequence = true;
    this.sequenceT = 0;

    // Electric field history, kV/m. Synthetic.
    this.fieldHistory = new Array(180).fill(0).map((_, i) => 0.6 + Math.sin(i * 0.05) * 0.5);
    this.field = this.fieldHistory[this.fieldHistory.length - 1];

    this.strikes = [];
    this.events = [];
    this.nodes = LDN_NODES.map((n) => ({
      id: n.id, x: n.x, z: n.z, online: true, gps: true, lastSeen: 0, noise: 12 + rng() * 8,
    }));

    this.squad = SQUAD.map((s, i) => ({
      id: s.id,
      link: true,
      battery: 68 + Math.floor(rng() * 28),
      lastUpdate: 0,
      // Placeholder metric fields — see systems.js notes.
      hr: 72 + Math.floor(rng() * 18),
      spo2: 93 + Math.floor(rng() * 4),
      temp: (36.4 + rng() * 0.8),
      state: 'OK',
    }));

    this.detections = DETECTIONS.map((d) => ({
      ...d, confidence: 0.72 + rng() * 0.2, age: rng() * 40,
      inZone: Math.hypot(d.x - GEOFENCE.cx, d.z - GEOFENCE.cz) < GEOFENCE.rx * 0.9,
    }));

    this.log('System', 'Demonstration state initialised — all values synthetic');
  }

  log(source, text, level = 'info') {
    this.events.unshift({ t: this.time, source, text, level });
    if (this.events.length > 60) this.events.pop();
  }

  clock() {
    // Presentation clock, not a real time source.
    const total = Math.floor(this.time);
    const h = 9 + Math.floor(total / 3600) % 24;
    const m = Math.floor(total / 60) % 60;
    const s = total % 60;
    const p = (v) => String(v).padStart(2, '0');
    return `${p(h)}:${p(m)}:${p(s)}`;
  }

  setLevel(level, source = 'Operator') {
    if (this.level === level) return;
    this.level = level;
    this.autoSequence = false;
    const map = { NORMAL: 'info', CAUTION: 'warn', ALERT: 'alert' };
    this.log(source, `Alert state set to ${level}`, map[level]);
    if (level === 'ALERT') {
      this.log('Early Warning', 'Beacon and sounder active · commander notified', 'alert');
    }
  }

  runSequence(enabled) {
    this.autoSequence = enabled;
    this.sequenceT = 0;
    if (enabled) this.log('Demo', 'Scripted warning sequence started', 'info');
  }

  addStrike(distanceKm, bearing) {
    const strike = {
      t: this.time,
      distance: distanceKm,
      bearing,
      x: GEOFENCE.cx + Math.cos(bearing) * distanceKm * 30,
      z: GEOFENCE.cz + Math.sin(bearing) * distanceKm * 30,
      node: this.nodes[Math.floor(rng() * this.nodes.length)].id,
    };
    this.strikes.unshift(strike);
    if (this.strikes.length > 24) this.strikes.pop();
    this.log('LDS', `Strike detected ${distanceKm.toFixed(1)} km · ${strike.node}`,
      distanceKm < 8 ? 'alert' : 'warn');
    return strike;
  }

  update(dt) {
    this.time += dt;

    // Scripted NORMAL -> CAUTION -> ALERT -> NORMAL demonstration cycle.
    if (this.autoSequence) {
      this.sequenceT += dt;
      const cycle = this.sequenceT % 72;
      const want = cycle < 32 ? 'NORMAL' : cycle < 50 ? 'CAUTION' : cycle < 64 ? 'ALERT' : 'NORMAL';
      if (want !== this.level) {
        this.level = want;
        const map = { NORMAL: 'info', CAUTION: 'warn', ALERT: 'alert' };
        this.log('Demo sequence', `State ${want}`, map[want]);
        if (want === 'ALERT') this.addStrike(3.2 + rng() * 4, rng() * Math.PI * 2);
      }
    }

    // Electric field: quiet band in NORMAL, rising trend under escalation.
    const target = this.level === 'NORMAL' ? 0.8 : this.level === 'CAUTION' ? 4.2 : 8.6;
    const wobble = Math.sin(this.time * 1.7) * 0.35 + Math.sin(this.time * 0.43) * 0.6;
    this.field += ((target + wobble) - this.field) * Math.min(1, dt * 0.9);
    this._acc = (this._acc || 0) + dt;
    if (this._acc > 0.5) {
      this._acc = 0;
      this.fieldHistory.push(this.field);
      if (this.fieldHistory.length > 180) this.fieldHistory.shift();
    }

    // Occasional strikes while escalated.
    this._strikeT = (this._strikeT || 0) + dt;
    const rate = this.level === 'ALERT' ? 3.5 : this.level === 'CAUTION' ? 9 : 26;
    if (this._strikeT > rate) {
      this._strikeT = 0;
      this.addStrike(2 + rng() * 26, rng() * Math.PI * 2);
    }

    // Squad telemetry drift (synthetic placeholders).
    for (const s of this.squad) {
      s.lastUpdate += dt;
      if (s.lastUpdate > 2) {
        s.lastUpdate = 0;
        s.hr = Math.max(58, Math.min(148, s.hr + (rng() - 0.5) * 6 + (this.level === 'ALERT' ? 1.6 : 0)));
        s.spo2 = Math.max(88, Math.min(99, s.spo2 + (rng() - 0.5) * 1.2));
        s.temp = Math.max(35.8, Math.min(37.6, s.temp + (rng() - 0.5) * 0.08));
        s.battery = Math.max(4, s.battery - dt * 0.002);
        s.link = rng() > 0.02;
        s.state = !s.link ? 'NO LINK' : s.hr > 128 ? 'EXERTION' : 'OK';
      }
    }

    for (const d of this.detections) d.age += dt;
    for (const n of this.nodes) n.lastSeen += dt;
  }
}
