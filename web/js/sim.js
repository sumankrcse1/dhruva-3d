// Demonstration state. Values are synthetic, but where a story drives them they
// come from a physical model rather than a script: the field-mill reading from
// the storm's charge geometry, heart rate from each soldier's workload, the
// barrier signal from the intruder's position in the beam.

import { LDN_NODES, SQUAD, DETECTIONS, GEOFENCE } from './layout.js';
import { makeRng } from './scene/noise.js';

const rng = makeRng(20260101);

export const LEVELS = ['NORMAL', 'CAUTION', 'ALERT'];

// Demonstration settings. In the product these are operator-editable.
export const THRESHOLDS = {
  fieldCaution: 1.0,   // kV/m, |potential gradient|
  fieldAlert: 3.0,     // kV/m
  hrLimit: 150,        // bpm, commander-set limit on the tablet
};

export class Simulation {
  constructor() {
    this.time = 0;
    this.level = 'NORMAL';
    this.cause = 'weather';
    this.autoSequence = false;
    this.sequenceT = 0;
    this.thresholds = THRESHOLDS;

    // Potential gradient history, kV/m. Fair weather is about +0.1 kV/m.
    this.fieldHistory = new Array(180).fill(0).map(() => 0.12 + (rng() - 0.5) * 0.04);
    this.field = 0.12;
    this.fieldSource = null;   // () => kV/m, set while a storm is present

    this.strikes = [];
    this.events = [];
    this.nodes = LDN_NODES.map((n) => ({
      id: n.id, x: n.x, z: n.z, online: true, gps: true, lastSeen: 0, noise: 12 + rng() * 8,
      lastArrival: null,
    }));

    this.squad = SQUAD.map((s) => ({
      id: s.id,
      link: true,
      battery: 68 + Math.floor(rng() * 28),
      restHr: s.restHr, fitness: s.fitness,
      hr: s.restHr + 20, spo2: 97.5, temp: 36.7,
      speed: 0, x: s.x, z: s.z,
      hrHist: [],
      state: 'OK',
    }));

    this.detections = DETECTIONS.map((d) => ({
      ...d, confidence: 0.72 + rng() * 0.2, age: rng() * 40,
      inZone: Math.hypot(d.x - GEOFENCE.cx, d.z - GEOFENCE.cz) < GEOFENCE.rx * 0.9,
    }));

    this.barrier = { links: [], breach: null };
    this.space = { tracks: [], flagged: null };

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

  /** `cause` says which subsystem raised it: weather drives the beacon and hooter. */
  setLevel(level, source = 'Operator', cause = 'weather') {
    if (this.level === level && this.cause === cause) return;
    this.level = level;
    this.cause = cause;
    this.autoSequence = false;
    const map = { NORMAL: 'info', CAUTION: 'warn', ALERT: 'alert' };
    this.log(source, `Alert state set to ${level}`, map[level]);
    if (level === 'ALERT' && cause === 'weather') {
      this.log('Early Warning', 'Beacon and hooter active · commander notified', 'alert');
    }
  }

  runSequence(enabled) {
    this.autoSequence = enabled;
    this.sequenceT = 0;
    if (enabled) this.log('Demo', 'Scripted warning sequence started', 'info');
  }

  addStrike(distanceKm, bearing) {
    return this.addStrikeAt({ distance: distanceKm, bearing, node: this.nodes[Math.floor(rng() * this.nodes.length)].id });
  }

  /** Strike located by the network (distance/bearing from the site, km/rad). */
  addStrikeAt({ distance, bearing, node = 'NETWORK', x = 0, z = 0 }) {
    const strike = { t: this.time, distance, bearing, x, z, node };
    this.strikes.unshift(strike);
    if (this.strikes.length > 24) this.strikes.pop();
    this.log('LDS', `Strike located ${distance.toFixed(1)} km · ${node}`, distance < 8 ? 'alert' : 'warn');
    return strike;
  }

  /** Called by the patrol mover every frame with each soldier's speed (m/s). */
  setSoldierMotion(i, x, z, speed) {
    const s = this.squad[i];
    if (!s) return;
    s.x = x; s.z = z; s.speed = speed;
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
        this.cause = 'weather';
        const map = { NORMAL: 'info', CAUTION: 'warn', ALERT: 'alert' };
        this.log('Demo sequence', `State ${want}`, map[want]);
        if (want === 'ALERT') this.addStrike(3.2 + rng() * 4, rng() * Math.PI * 2);
      }
      this._strikeT = (this._strikeT || 0) + dt;
      const rate = this.level === 'ALERT' ? 3.5 : this.level === 'CAUTION' ? 9 : 26;
      if (this._strikeT > rate) {
        this._strikeT = 0;
        this.addStrike(2 + rng() * 26, rng() * Math.PI * 2);
      }
    }

    // Field-mill reading: physical model when a storm is present, otherwise
    // the fair-weather value; the scripted sequence keeps its old behaviour.
    const noise = Math.sin(this.time * 1.7) * 0.02 + Math.sin(this.time * 0.43) * 0.03;
    let target;
    if (this.fieldSource) target = this.fieldSource();
    else if (this.autoSequence) target = this.level === 'NORMAL' ? 0.12 : this.level === 'CAUTION' ? -2.0 : -5.5;
    else target = 0.12;
    // The mill's output is smoothed over about a second.
    this.field += ((target + noise) - this.field) * Math.min(1, dt * 2.5);
    this._acc = (this._acc || 0) + dt;
    if (this._acc > 0.25) {
      this._acc = 0;
      this.fieldHistory.push(this.field);
      if (this.fieldHistory.length > 180) this.fieldHistory.shift();
    }

    // Soldier physiology: heart rate relaxes toward a workload-dependent
    // target with a lag (τ ≈ 8 s, time-compressed from ~30–60 s).
    for (const s of this.squad) {
      const target = s.restHr + 22 * s.speed * s.fitness;
      s.hr += (target - s.hr) * Math.min(1, dt / 8);
      const strain = Math.max(0, (s.hr - 120) / 60);
      s.spo2 += ((97.6 - strain * 2.2) - s.spo2) * Math.min(1, dt / 6);
      s.temp += ((36.6 + (s.hr - s.restHr) * 0.011) - s.temp) * Math.min(1, dt / 40);
      s.battery = Math.max(4, s.battery - dt * 0.004);
      s._acc = (s._acc || 0) + dt;
      if (s._acc > 1) {
        // Watches report once per second.
        s._acc = 0;
        s.hrHist.push(s.hr);
        if (s.hrHist.length > 60) s.hrHist.shift();
      }
      const was = s.state;
      s.state = !s.link ? 'NO LINK' : s.hr > this.thresholds.hrLimit ? 'HIGH HR' : 'OK';
      if (s.state === 'HIGH HR' && was !== 'HIGH HR') {
        this.log('Wearable', `${s.id} heart rate ${s.hr.toFixed(0)} bpm above limit`, 'warn');
      }
    }

    for (const d of this.detections) d.age += dt;
    for (const n of this.nodes) n.lastSeen += dt;
  }
}
