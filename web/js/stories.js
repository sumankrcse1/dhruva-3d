// Story director: one complete, physically driven story per product.
//
//   storm      cloud builds and drifts in -> EFM field rises -> CAUTION -> ALERT, hooter
//   lightning  stepped leader + return stroke -> radio pulse reaches the ANT-50 nodes
//              at different times -> time-of-arrival hyperbolas -> strike located
//   wearable   patrol walks, watches report -> commander's tablet -> exertion alert
//   satellite  catalogued passes -> new object rises -> station tracks -> no catalogue
//              match -> flagged as a possible reconnaissance satellite
//   geofence   TX -> RX microwave links -> intruder climbs the fence -> beam broken
//
// A story is a list of steps. A step fires `after` seconds after the previous
// one, or as soon as `when()` is true (with a timeout). The world keeps running
// underneath: the story only sets up conditions and moves the camera; alert
// states come out of the physics (field strength, beam loss, heart rate).

import * as THREE from 'three';
import {
  Storm, LightningBolt, Wavefront, hyperbolaSegments, groundLine, strikeMarker,
  STORM_SCALE, C_LIGHT, C_SOUND, CLOUD_BASE_Y,
} from './scene/storm.js';
import { BarrierNetwork, Intruder, Constellation } from './scene/story_assets.js';
import { A, FENCE_PATH } from './layout.js';
import { terrainHeight } from './scene/terrain.js';
import { SoundEngine } from './audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

export class StoryDirector {
  constructor(app) {
    this.app = app;
    this.sim = app.sim;
    this.scene = app.scene;
    this.sound = new SoundEngine();

    this.storm = new Storm(this.scene);
    this.bolts = [];
    this.waves = [];
    this.fx = [];              // disposable scene objects added by a story
    this.labels = [];          // dynamic callouts added by a story

    this.barrier = new BarrierNetwork();
    app.zoneGroups['07_OPTIONAL_BORDER_TECH'].add(this.barrier.group);
    this.intruder = new Intruder(this.scene);

    const dish2 = app.command.userData.dishes[1];
    const station = dish2.getWorldPosition(new THREE.Vector3()).add(V(0, 4, 0));
    this.constellation = new Constellation(this.scene, station);
    app.zoneGroups['07_OPTIONAL_BORDER_TECH'].add(this.constellation.group);

    this.efmPos = V(A.efm.x, 0, A.efm.z);
    this.story = null;
    this.hooterT = 0;
    this.patrolSpeed = 1.4;

    this.ui = {
      root: document.getElementById('story'),
      step: document.querySelector('#story .story__step'),
      title: document.querySelector('#story .story__title'),
      text: document.querySelector('#story .story__text'),
      bar: document.querySelector('#story .story__bar i'),
    };
    this.stories = this.defineStories();
  }

  // -- public ----------------------------------------------------------------
  has(id) { return !!this.stories[id]; }

  play(id, onDone) {
    this.stop(false);
    const s = this.stories[id];
    if (!s) return;
    this.story = { ...s, id, index: 0, stepT: 0, elapsed: 0, onDone, total: s.steps.length };
    s.setup?.();
    this.ui.root?.classList.add('is-open');
    this.advance();
  }

  stop(clearWorld = true) {
    if (!this.story) return;
    this.story.teardown?.();
    this.story = null;
    this.follow = null;
    this.ui.root?.classList.remove('is-open');
    for (const l of this.labels) this.app.callouts.remove(l);
    this.labels = [];
    for (const o of this.fx) { this.scene.remove(o); o.traverse?.((m) => m.geometry?.dispose()); }
    this.fx = [];
    this.strikeMarkerObj = null;
    if (clearWorld) this.patrolSpeed = 1.4;
  }

  setSound(on) { this.sound.setEnabled(on); }

  // -- step machinery --------------------------------------------------------
  advance() {
    const st = this.story;
    const step = st.steps[st.index];
    st.index += 1;
    st.stepT = 0;
    if (step.caption) this.caption(step.caption, st.index, st.total);
    if (step.shot) this.shot(typeof step.shot === 'function' ? step.shot() : step.shot);
    if (step.follow !== undefined) this.follow = step.follow;
    step.run?.();
    if (step.end) this.finish();
  }

  finish() {
    const done = this.story?.onDone;
    this.stop(false);
    done?.();
  }

  caption(c, i, n) {
    this.captionSpec = c;
    if (!this.ui.root) return;
    this.ui.step.textContent = `${this.story?.title ?? ''} · step ${i} of ${n}`;
    this.ui.title.textContent = c.title;
    this.ui.text.textContent = typeof c.text === 'function' ? c.text() : c.text;
  }

  shot({ pos, target, fov = 45, dur = 2.2 }) {
    this.follow = null;
    this.app.flyTo(pos.clone ? pos.clone() : V(...pos), target.clone ? target.clone() : V(...target), fov, dur);
  }

  label(spec) {
    const item = this.app.callouts.add({ maxDistance: 5000, ...spec });
    this.labels.push(item);
    return item;
  }

  addFx(obj) { this.scene.add(obj); this.fx.push(obj); return obj; }

  // -- story definitions -----------------------------------------------------
  defineStories() {
    const app = this.app, sim = this.sim, storm = this.storm;
    const th = sim.thresholds;

    // ---------------------------------------------------------------- storm
    const storm1 = {
      title: 'EFM early warning',
      setup: () => {
        storm.reset(-760, 62, 0.35);
        storm.wind.set(20, 0, 0);
        storm.qNeg = -14; storm.qPos = 14;
        storm.growth = 0.028;   // maturity per second
        app.selectSystem('efm', { fly: false });
      },
      steps: [
        {
          caption: {
            title: 'A thunderstorm builds upwind',
            text: 'Updrafts separate charge inside the cloud: negative charge collects low (≈6 km), positive charge high (≈10 km). The wind carries the cell toward the site. Rain falls from the base at its terminal speed.',
          },
          shot: { pos: V(80, 60, 330), target: V(-420, 260, 40), fov: 55, dur: 2.5 },
        },
        {
          after: 9,
          caption: {
            title: 'The EFM feels the charge before any lightning',
            text: () => `The field mill's rotating shutter alternately covers and exposes its sensing plates; the induced charge is proportional to the vertical field. Fair weather ≈ +0.1 kV/m. Now: ${sim.field.toFixed(2)} kV/m and falling as the negative base approaches.`,
          },
          shot: { pos: V(-10, 20, 165), target: V(-110, 95, 70), fov: 60, dur: 2.5 },
        },
        {
          when: () => sim.level === 'CAUTION' || sim.level === 'ALERT', timeout: 30,
          caption: {
            title: `CAUTION — field beyond ${th.fieldCaution} kV/m`,
            text: () => `Reading ${sim.field.toFixed(2)} kV/m. The beacon turns amber and the commander is notified. No lightning yet — this is the early part of early warning.`,
          },
          run: () => storm.wind.set(11, 0, 0),
        },
        {
          when: () => sim.level === 'ALERT', timeout: 30,
          caption: {
            title: `ALERT — ${th.fieldAlert} kV/m: hooter sounds`,
            text: () => `Reading ${sim.field.toFixed(2)} kV/m. Beacon red, hooter on. Sound spreads at 343 m/s — the rings show the wavefront, and it gets quieter with distance (inverse-square). Personnel clear exposed positions.`,
          },
          shot: { pos: V(-48, 32, 178), target: V(-95, 20, 118), fov: 50, dur: 2.2 },
          // The mature cell slows as it arrives over the valley.
          run: () => storm.wind.set(6, 0, 0),
        },
        {
          after: 9,
          caption: {
            title: 'Warning given before the first strike',
            text: 'The cell is still charging and no lightning has occurred: the EFM gave the site its lead time. Next: the first strike, and how the lightning network locates it.',
          },
          shot: { pos: V(80, 60, 330), target: V(-300, 240, 50), fov: 55, dur: 2.5 },
        },
        { after: 7, end: true },
      ],
    };

    // ------------------------------------------------------------ lightning
    let strike = null;
    // Arrivals recorded by updatePulse(), earliest first.
    const arrivalsOf = () => [...(this.story?._arrivals || [])].sort((a, b) => a.us - b.us);
    const lightning = {
      title: 'Lightning detection',
      setup: () => {
        if (!storm.active || storm.center.x < -600 || storm.center.x > 300) {
          storm.reset(-330, 62, 1);
          storm.opacity = 1;
          storm.qNeg = -40; storm.qPos = 40;
        }
        storm.maturity = 1;
        storm.growth = 0;
        storm.wind.set(6, 0, 0);
        strike = null;
        app.selectSystem('lds', { fly: false });
      },
      steps: [
        {
          caption: {
            title: 'Charge reaches breakdown',
            text: 'Inside the mature cell the field between the negative base and the ground approaches the breakdown strength of air. A discharge is imminent.',
          },
          shot: () => ({ pos: V(storm.center.x + 430, 70, 430), target: V(storm.center.x + 40, 170, 70), fov: 55, dur: 2.2 }),
        },
        {
          after: 3,
          caption: {
            title: 'Stepped leader → return stroke',
            text: 'A faint stepped leader works down from the cloud base in jumps (slowed here; really ~20 ms). When it connects, the return stroke flashes up the channel at ~30,000 °C. The EFM sees a sudden step in the field; thunder arrives distance ÷ 343 m/s later.',
          },
          run: () => { strike = this.triggerStrike(); },
        },
        {
          after: 2.2,
          caption: {
            title: 'The radio pulse reaches each ANT-50 at a different time',
            text: () => `The stroke radiates a VLF/LF radio pulse travelling at the speed of light (shown slowed ~10 million×). Each node's LRX-1 stamps the arrival with GPS time. ${arrivalsOf().map((a) => `${a.id}: ${a.us.toFixed(3)} µs`).join(' · ')}`,
          },
          shot: { pos: V(-40, 330, 430), target: V(-20, 0, 40), fov: 52, dur: 2.6 },
        },
        {
          when: () => arrivalsOf().length >= 3, timeout: 8,
          caption: {
            title: 'Time differences → hyperbolas',
            text: () => {
              const [a, b, c] = arrivalsOf();
              if (!c) return 'Waiting for all three nodes…';
              return `Each pair of arrival times fixes a hyperbola of possible strike points: Δt(${a.id}–${b.id}) = ${(b.us - a.us).toFixed(3)} µs, Δt(${a.id}–${c.id}) = ${(c.us - a.us).toFixed(3)} µs. Where they cross is the strike.`;
            },
          },
          run: () => this.drawHyperbolas(strike),
        },
        {
          after: 3.2,
          caption: {
            title: 'Strike located, alert raised',
            text: () => strike ? `Located ${strike.km.toFixed(1)} km from the EFM, bearing ${strike.bearingDeg.toFixed(0)}°. It is plotted on the LDS map and the command screens within seconds; inside the monitored ring the site stays at ALERT.` : '',
          },
          run: () => this.markStrike(strike),
        },
        { after: 8, end: true },
      ],
      teardown: () => {},
    };

    // ------------------------------------------------------------- wearable
    const wearable = {
      title: 'Soldier health monitoring',
      setup: () => {
        this.patrolSpeed = 1.4;
        app.selectSystem('wearable', { fly: false });
        app.panel.setDashboard('tablet');
      },
      steps: [
        {
          caption: {
            title: 'Patrol on the move — every soldier wears the watch',
            text: 'Heart rate (optical, from the wrist), SpO₂, skin temperature, battery and position are sampled on the watch and sent over the field radio link about once a second.',
          },
          shot: { pos: V(-282, 17, 146), target: V(-318, 8, 111), fov: 46, dur: 2.4 },
        },
        {
          after: 6,
          caption: {
            title: 'On the wrist',
            text: 'The wearer sees their own status; the same readings stream to the server over the green telemetry links.',
          },
          run: () => app.flyToSystem('wearable'),
        },
        {
          after: 5.5,
          caption: {
            title: "Commander's tablet: the whole squad, live",
            text: 'Positions on the map, and a card per soldier with heart rate and its last minute of history. Every value here is computed from what the soldiers are actually doing in the scene.',
          },
          shot: () => this.tabletShot(),
        },
        {
          after: 6,
          caption: {
            title: 'Double time',
            text: () => `The patrol speeds up to 3 m/s. Heart rate follows workload with a physiological lag, so values climb over several seconds. SOLDIER 04 is working hardest: ${sim.squad[3].hr.toFixed(0)} bpm.`,
          },
          shot: { pos: V(-290, 22, 150), target: V(-322, 8, 112), fov: 50, dur: 2 },
          run: () => { this.patrolSpeed = 3.0; },
        },
        {
          when: () => sim.squad[3].state === 'HIGH HR', timeout: 25,
          caption: {
            title: 'SOLDIER 04 flagged on the tablet',
            text: () => `${sim.squad[3].hr.toFixed(0)} bpm, above the commander's limit of ${th.hrLimit} bpm. The tablet shows who and where. (Limit is a demonstration setting; no medical claim is made.)`,
          },
          shot: () => this.tabletShot(),
          run: () => this.sound.beep('notify'),
        },
        {
          after: 5,
          caption: {
            title: 'Commander acts: patrol halts, heart rates recover',
            text: 'The commander halts the patrol. Heart rates fall back toward resting over the following seconds — visible on each card.',
          },
          shot: { pos: V(-282, 17, 146), target: V(-318, 8, 111), fov: 46, dur: 2 },
          run: () => { this.patrolSpeed = 0; },
        },
        {
          after: 8,
          caption: { title: 'Patrol resumes', text: 'Back to walking pace; monitoring continues.' },
          run: () => { this.patrolSpeed = 1.4; },
        },
        { after: 3, end: true },
      ],
      teardown: () => { this.patrolSpeed = 1.4; app.panel.setDashboard(null); },
    };

    // ------------------------------------------------------------ satellite
    const con = this.constellation;
    const station = con.station;
    const satellite = {
      title: 'Space watch',
      setup: () => {
        con.scheduleSpy(7);
        con.trackTarget = null;
        sim.space.flagged = null;
        app.selectSystem('satellite', { fly: false });
      },
      steps: [
        {
          caption: {
            title: 'Satellites cross the sky every few minutes',
            text: 'Low-Earth-orbit satellites move at ~7.6 km/s. Their motion obeys Kepler’s laws — lower orbits are faster — so every catalogued object has a predictable pass (dashed tracks). The geostationary link satellite stays fixed.',
          },
          shot: { pos: station.clone().add(V(60, 16, 90)), target: V(-900, 520, -700), fov: 58, dur: 2.6 },
        },
        {
          when: () => con.spy.look && con.spy.look.el > 8, timeout: 20,
          caption: {
            title: 'New object above the horizon',
            text: () => `The ground station acquires it and slews its antenna to track: azimuth ${con.spy.look.az.toFixed(0)}°, elevation ${con.spy.look.el.toFixed(0)}°, range ${con.spy.look.rangeKm.toFixed(0)} km.`,
          },
          run: () => { con.trackTarget = con.spy; this.sound.beep('lock'); },
          follow: () => ({ pos: station.clone().add(V(40, 14, 70)), target: con.spy.mesh.position, fov: 50 }),
        },
        {
          after: 4.5,
          caption: {
            title: 'Catalogue check: NO MATCH',
            text: 'The measured orbit is compared with every catalogued object. Nothing matches, so the object is flagged as a possible reconnaissance satellite. Its imaging footprint and the time until it sets are predicted.',
          },
          run: () => {
            con.markSpy();
            sim.space.flagged = { id: con.spy.spec.id, los: 0 };
            sim.setLevel('ALERT', 'Space watch', 'space');
            sim.log('Space watch', `${con.spy.spec.id} uncatalogued · possible reconnaissance pass`, 'alert');
            this.sound.beep('alert');
          },
        },
        {
          after: 5,
          caption: {
            title: 'Protect: conceal until loss of signal',
            text: () => `Sensor footprint (red cone) is sweeping the area. Sensitive activity is paused or covered until the pass ends — loss of signal in ${Math.max(0, sim.space.flagged?.los ?? 0).toFixed(0)} s.`,
          },
          follow: () => ({ pos: station.clone().add(V(-160, 120, 260)), target: con.spy.nadir || con.spy.mesh.position, fov: 60 }),
        },
        {
          when: () => !con.spy.look || con.spy.look.el < 2, timeout: 30,
          caption: {
            title: 'Pass complete',
            text: 'The object has set below the horizon. The track is kept, so its next pass can be predicted and warned in advance. State returns to NORMAL.',
          },
          shot: { pos: station.clone().add(V(60, 16, 90)), target: V(600, 300, 400), fov: 55, dur: 2.5 },
          run: () => {
            con.trackTarget = null;
            sim.space.flagged = null;
            sim.setLevel('NORMAL', 'Space watch', 'space');
          },
        },
        { after: 4, end: true },
      ],
      teardown: () => {
        con.hideSpy();
        sim.space.flagged = null;
        if (sim.cause === 'space' && sim.level !== 'NORMAL') sim.setLevel('NORMAL', 'Space watch', 'space');
      },
    };

    // ------------------------------------------------------------- geofence
    const link = this.barrier.sections[2];   // BS-03 → BS-04
    const geofence = {
      title: 'Perimeter intrusion',
      setup: () => {
        sim.barrier.breach = null;
        app.selectSystem('geofence', { fly: false });
      },
      steps: [
        {
          caption: {
            title: 'An invisible fence: TX → RX microwave links',
            text: 'Between each pair of posts a transmitter floods an ellipsoidal zone to a receiver. The receiver measures the signal level continuously — the waves flow from TX to RX.',
          },
          shot: () => this.barrierShot(link, 'wide'),
        },
        {
          after: 5,
          caption: {
            title: 'Movement outside the wire',
            text: 'A person approaches the perimeter from outside, crouched, between posts BS-03 and BS-04.',
          },
          run: () => this.startIntruder(link),
          shot: () => this.barrierShot(link, 'close'),
        },
        {
          when: () => this.intruder.state === 'climb', timeout: 30,
          caption: { title: 'Fence climbed', text: 'The intruder climbs the 3 m fence and drops inside — a free fall of about 0.8 s.' },
        },
        {
          when: () => sim.barrier.breach, timeout: 20,
          caption: {
            title: 'Beam broken → INTRUSION',
            text: () => `A body in the zone absorbs and scatters the microwave energy: RX level ${link.rssi.toFixed(1)} dBm, ${(link.base - link.rssi).toFixed(1)} dB below normal. The drop — not a camera — triggers the alarm, with link ID, time and position sent to command.`,
          },
        },
        {
          after: 5,
          caption: {
            title: 'Command responds',
            text: 'The event appears on the command screens with the breached link highlighted; the nearest patrol and the tower are tasked to the position.',
          },
          shot: () => this.barrierShot(link, 'high'),
        },
        { after: 6, end: true },
      ],
      teardown: () => {
        this.intruder.hide();
        sim.barrier.breach = null;
        if (sim.cause === 'intrusion') sim.setLevel('NORMAL', 'Geofence', 'intrusion');
      },
    };

    return { storm: storm1, lightning, wearable, satellite, geofence };
  }

  // -- story actions -----------------------------------------------------------
  triggerStrike() {
    const storm = this.storm;
    // Under the main core, a few kilometres upwind of the EFM.
    const gx = storm.center.x - 80, gz = storm.center.z + 30;
    const to = V(gx, terrainHeight(gx, gz), gz);
    const from = V(gx - 30, CLOUD_BASE_Y + 30, gz - 10);
    const bolt = new LightningBolt(this.scene, from, to, Math.floor(this.sim.time * 1000), storm.flashLight);
    this.bolts.push(bolt);
    const dE = { before: 0 };
    const efm = this.efmPos;
    const info = { x: gx, z: gz, arrivals: [] };
    bolt.onAttach = () => {
      // EFM: a discharge shows as a sudden step in the static field.
      dE.before = storm.fieldAt(efm.x, efm.z);
      storm.discharge(0.5);
      const after = storm.fieldAt(efm.x, efm.z);
      this.sim.log('EFM', `Sudden field change ${(after - dE.before > 0 ? '+' : '')}${(after - dE.before).toFixed(1)} kV/m — lightning nearby`, 'alert');
      // Thunder: light arrives at once, sound after distance / 343 m/s.
      const d = this.app.camera.position.distanceTo(to);
      this.sound.thunder(d, d / C_SOUND);
      // Radio pulse, displayed at 180 scene m/s.
      const wave = new Wavefront(this.scene, to, { color: '#b58cff', speed: 180, maxR: 820, opacity: 0.4 });
      this.waves.push(wave);
      this.pulse = { wave, to, received: new Set() };
    };
    const dx = gx - efm.x, dz = gz - efm.z;
    info.km = (Math.hypot(dx, dz) * STORM_SCALE) / 1000;
    info.bearing = Math.atan2(dz, dx);
    info.bearingDeg = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
    this.currentStrike = info;
    return info;
  }

  /** Called every frame while a radio pulse is expanding. */
  updatePulse() {
    const p = this.pulse;
    if (!p) return;
    this.app.lightningNodes.forEach((n, i) => {
      if (p.received.has(i)) return;
      const d2 = Math.hypot(n.spec.x - p.to.x, n.spec.z - p.to.z);
      if (p.wave.r < d2) return;
      p.received.add(i);
      const us = (d2 * STORM_SCALE / C_LIGHT) * 1e6;
      const rec = { id: n.spec.id, i, d: d2, us };
      this.story?.id === 'lightning' && this.currentArrivals().push(rec);
      this.sim.nodes[i].lastArrival = us;
      this.sim.nodes[i].lastSeen = 0;
      this.sim.log('LRX-1', `${n.spec.id} pulse received · GPS time +${us.toFixed(3)} µs`, 'warn');
      // Node flash: LRX-1 strike LED and a small ring at the antenna.
      n.flash = 1;
      this.waves.push(new Wavefront(this.scene, ground3(n.spec.x, n.spec.z, 9), {
        color: '#7fe3ff', speed: 60, maxR: 40, opacity: 0.7, ground: false,
      }));
      const item = this.label({
        title: `${n.spec.id} · +${us.toFixed(3)} µs`, sub: 'pulse received (GPS-timed)',
        position: ground3(n.spec.x, n.spec.z, 14), kind: 'plain', offset: [20, -70],
      });
      item.el.classList.add('callout--story');
    });
    if (p.received.size >= this.app.lightningNodes.length) this.pulse = null;
  }

  currentArrivals() {
    // Arrivals for the running lightning story, in the story's closure list.
    const s = this.story;
    if (!s._arrivals) s._arrivals = [];
    return s._arrivals;
  }

  drawHyperbolas(strike) {
    const arr = [...(this.story?._arrivals || [])].sort((a, b) => a.us - b.us);
    if (arr.length < 3) return;
    const nodes = this.app.lightningNodes.map((n) => n.spec);
    const [a, b, c] = arr;
    const pairs = [[a, b, '#ffd24a'], [a, c, '#b58cff']];
    for (const [p, q, color] of pairs) {
      // |P − A| − |P − B| = d_A − d_B, from the measured time difference.
      const A_ = nodes[p.i], B_ = nodes[q.i];
      const dd = ((p.us - q.us) * 1e-6 * C_LIGHT) / STORM_SCALE;
      const seg = hyperbolaSegments({ x: A_.x, z: A_.z }, { x: B_.x, z: B_.z }, dd, 1500);
      this.addFx(groundLine(seg, color, 2));
    }
  }

  markStrike(strike) {
    if (!strike) return;
    const m = this.addFx(strikeMarker(strike.x, strike.z));
    m.userData.born = this.sim.time;
    this.strikeMarkerObj = m;
    this.label({
      title: `STRIKE LOCATED · ${strike.km.toFixed(1)} km`, sub: `bearing ${strike.bearingDeg.toFixed(0)}° from EFM`,
      position: ground3(strike.x, strike.z, 10), kind: 'detect-person', offset: [30, -90],
    });
    this.sim.addStrikeAt({ distance: strike.km, bearing: strike.bearing, node: 'NET 3/3' });
  }

  tabletShot() {
    const cmd = this.app.squad.userData.commander;
    const dev = this.app.squad.userData.tablet;
    cmd.updateMatrixWorld(true);
    const p = dev.getWorldPosition(new THREE.Vector3());
    const q = dev.getWorldQuaternion(new THREE.Quaternion());
    const n = V(0, 0, 1).applyQuaternion(q);
    const left = V(-1, 0, 0).applyQuaternion(cmd.quaternion);
    // Over the commander's left shoulder, clear of the helmet.
    return { pos: p.clone().addScaledVector(n, 0.5).addScaledVector(left, 0.3).add(V(0, 0.06, 0)), target: p, fov: 40, dur: 2 };
  }

  barrierShot(link, kind) {
    const mid = link.pTx.clone().lerp(link.pRx, 0.5);
    mid.y = terrainHeight(mid.x, mid.z) + 2;
    const axis = link.pRx.clone().sub(link.pTx).setY(0).normalize();
    const outward = V(axis.z, 0, -axis.x);   // points outside the perimeter
    if (outward.x + outward.z < 0) outward.multiplyScalar(-1);
    if (kind === 'wide') {
      return { pos: mid.clone().addScaledVector(outward, -60).addScaledVector(axis, -40).add(V(0, 32, 0)), target: mid, fov: 50, dur: 2.4 };
    }
    if (kind === 'high') {
      return { pos: mid.clone().addScaledVector(outward, -45).add(V(0, 60, 0)), target: mid, fov: 50, dur: 2.2 };
    }
    return { pos: mid.clone().addScaledVector(outward, -24).addScaledVector(axis, -16).add(V(0, 9, 0)), target: mid.clone().addScaledVector(outward, 8), fov: 50, dur: 2.2 };
  }

  startIntruder(link) {
    const mid = link.pTx.clone().lerp(link.pRx, 0.5);
    const axis = link.pRx.clone().sub(link.pTx).setY(0).normalize();
    const outward = V(axis.z, 0, -axis.x);
    if (outward.x + outward.z < 0) outward.multiplyScalar(-1);
    // Where the walk line actually meets the fence polyline.
    const toFence = fenceDistance(mid, outward) ?? 6;
    const start = mid.clone().addScaledVector(outward, toFence + 16);
    const fence = mid.clone().addScaledVector(outward, toFence + 0.6);
    const stop = mid.clone().addScaledVector(outward, -6);
    this.intruder.start({ x: start.x, z: start.z }, { x: fence.x, z: fence.z }, { x: stop.x, z: stop.z });
  }

  // -- continuous world update -------------------------------------------------
  update(dt) {
    const app = this.app, sim = this.sim;
    const st = this.story;

    // Story step timing.
    if (st) {
      st.stepT += dt;
      st.elapsed += dt;
      const next = st.steps[st.index];
      if (next) {
        const ready = next.when
          ? (next.when() || st.stepT >= (next.timeout ?? 20))
          : st.stepT >= (next.after ?? 0);
        if (ready) this.advance();
      }
      if (this.story && this.captionSpec && typeof this.captionSpec.text === 'function') {
        this._capAcc = (this._capAcc || 0) + dt;
        if (this._capAcc > 0.25) { this._capAcc = 0; this.ui.text.textContent = this.captionSpec.text(); }
      }
      if (this.story && this.ui.bar) {
        this.ui.bar.style.width = `${Math.min(100, ((this.story.index) / this.story.total) * 100)}%`;
      }
    }

    // Camera follow mode (tracks a moving subject).
    if (this.follow && !app.fly) {
      const f = this.follow();
      const k = Math.min(1, dt * 2.2);
      app.camera.position.lerp(f.pos, k);
      app.controls.target.lerp(f.target, k);
      if (f.fov) { app.camera.fov += (f.fov - app.camera.fov) * k; app.camera.updateProjectionMatrix(); }
    }

    // Storm, maturity growth, weather alert from the field reading.
    const storm = this.storm;
    if (storm.active && storm.growth) storm.maturity = Math.min(1, storm.maturity + storm.growth * dt);
    // A cell that has blown well past the site dissipates.
    if (storm.active && storm.center.x > 900) storm.dismiss();
    storm.update(dt, sim.time, app.camera);
    if (storm.opacity > 0.01) {
      sim.fieldSource = () => storm.fieldAt(this.efmPos.x, this.efmPos.z);
      const E = Math.abs(sim.field);
      const t = sim.thresholds;
      if (sim.cause === 'weather' || sim.level === 'NORMAL') {
        if (E >= t.fieldAlert) sim.setLevel('ALERT', 'EFM', 'weather');
        else if (E >= t.fieldCaution && sim.level !== 'ALERT') sim.setLevel('CAUTION', 'EFM', 'weather');
        else if (E < t.fieldCaution * 0.7 && sim.level !== 'NORMAL' && sim.cause === 'weather') sim.setLevel('NORMAL', 'EFM', 'weather');
      }
    } else if (sim.fieldSource) {
      sim.fieldSource = null;
      if (sim.cause === 'weather' && sim.level !== 'NORMAL') sim.setLevel('NORMAL', 'EFM', 'weather');
    }
    // Overcast follows how close and how developed the cell is.
    const dSite = Math.hypot(storm.center.x - 20, storm.center.z - 60);
    const oc = storm.opacity * (0.35 + 0.65 * storm.maturity) * (1 - smooth(350, 1300, dSite));
    app.sky.setOvercast(oc);
    this.sound.setRain(storm.rainRate * (1 - smooth(250, 900, app.camera.position.distanceTo(storm.center.clone().setY(40)))));

    // Lightning and wavefronts.
    let flash = 0;
    for (const b of this.bolts) { b.update(dt); flash = Math.max(flash, b.brightness || 0); }
    this.bolts = this.bolts.filter((b) => !b.done);
    app.sky.setFlash(flash);
    this.updatePulse();
    for (const w of this.waves) w.update(dt);
    this.waves = this.waves.filter((w) => !w.done);
    for (const n of app.lightningNodes) {
      if (!n.flash) continue;
      n.flash = Math.max(0, n.flash - dt * 0.8);
      const led = n.cab.getObjectByName('LRX1_LED_Strike');
      if (led) led.material.emissiveIntensity = 3.2 + n.flash * 30;
    }
    if (this.strikeMarkerObj) {
      const age = sim.time - this.strikeMarkerObj.userData.born;
      this.strikeMarkerObj.userData.ringMat.opacity = 0.5 + 0.45 * Math.sin(age * 5);
    }

    // Hooter: follows the weather ALERT; loudness falls off with distance.
    const hooterOn = sim.level === 'ALERT' && sim.cause === 'weather';
    const beacon = app.warning.userData.beacon.getWorldPosition(new THREE.Vector3());
    if (hooterOn) {
      this.sound.startHooter();
      const d = app.camera.position.distanceTo(beacon);
      this.sound.setHooterLevel(Math.min(1, 45 / Math.max(1, d)));
      this.hooterT -= dt;
      if (this.hooterT <= 0) {
        this.hooterT = 0.55;
        this.waves.push(new Wavefront(this.scene, beacon, {
          color: '#ff7a3a', speed: C_SOUND, maxR: 130, opacity: 0.22,
        }));
      }
    } else {
      this.sound.stopHooter();
    }

    // Perimeter barrier and intruder.
    this.intruder.update(dt);
    this.barrier.update(dt, sim.time, this.intruder.chest);
    sim.barrier.links = this.barrier.sections;
    const broken = this.barrier.sections.find((l) => l.broken > 0.5);
    if (broken && !sim.barrier.breach && this.intruder.fig.visible) {
      sim.barrier.breach = broken.id;
      this.intruder.bracket.visible = true;
      sim.setLevel('ALERT', 'Geofence', 'intrusion');
      sim.log('Geofence', `Beam ${broken.id} broken · intrusion at the perimeter`, 'alert');
      this.sound.beep('alert');
      const item = this.label({
        title: 'INTRUSION', sub: `link ${broken.id} · beam broken`,
        position: this.intruder.fig.position.clone().add(V(0, 2.4, 0)), kind: 'detect-person', offset: [-40, -80],
      });
      item.follow = this.intruder.fig;
    }
    for (const l of this.labels) {
      if (l.follow) l.position.copy(l.follow.position).add(V(0, 2.4, 0));
    }

    // Space segment, and the station dishes physically pointing at targets.
    const con = this.constellation;
    con.update(dt, app.camera);
    sim.space.tracks = con.tracks();
    if (sim.space.flagged && con.spy.look) {
      // Time until the object sets: remaining angle to the horizon ÷ ω.
      sim.space.flagged.los = Math.max(0, (con.spy.phiMax - 0.08 - con.spy.phi) / con.spy.omega);
    }
    const dishes = app.command.userData.dishes;
    aimDish(dishes[0], app.drone.position);
    aimDish(dishes[1], con.trackTarget ? con.trackTarget.mesh.position : app.satellites.userData.sats[0].position);
  }
}

/** Distance along a ground ray (origin, unit dir in xz) to the fence line. */
function fenceDistance(o, d) {
  let best = null;
  for (let i = 0; i < FENCE_PATH.length - 1; i++) {
    const [ax, az] = FENCE_PATH[i], [bx, bz] = FENCE_PATH[i + 1];
    const ex = bx - ax, ez = bz - az;
    const den = d.x * ez - d.z * ex;
    if (Math.abs(den) < 1e-9) continue;
    const wx = ax - o.x, wz = az - o.z;
    const s = (wx * ez - wz * ex) / den;       // along the ray
    const u = (wx * d.z - wz * d.x) / den;     // along the fence segment
    if (s > 0 && u >= 0 && u <= 1 && (best === null || s < best)) best = s;
  }
  return best;
}

function ground3(x, z, lift = 0) {
  return new THREE.Vector3(x, terrainHeight(x, z) + lift, z);
}

/** Point a ground-station dish's boresight at a world position (az / el mount). */
const _v = new THREE.Vector3();
function aimDish(dish, target) {
  const head = dish.userData.head;
  if (!head) return;
  head.rotation.order = 'YXZ';
  dish.updateMatrixWorld(true);
  _v.copy(target);
  dish.worldToLocal(_v).sub(head.position).normalize();
  const el = Math.acos(THREE.MathUtils.clamp(_v.y, -1, 1));
  const az = Math.atan2(_v.x, _v.z);
  // Rate-limited slew, like a real pedestal.
  const k = 0.08;
  head.rotation.x += (Math.min(el, 1.45) - head.rotation.x) * k;
  let dAz = az - head.rotation.y;
  dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
  head.rotation.y += dAz * k;
}
