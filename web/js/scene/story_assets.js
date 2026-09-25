// Props that exist to tell the product stories: the microwave barrier (TX/RX
// links between the perimeter posts), the intruder, and the orbiting space
// segment with an uncatalogued satellite and the ground-station tracking beam.

import * as THREE from 'three';
import { mat, matClone } from './materials.js';
import { roundedBox } from './devices.js';
import { terrainHeight } from './terrain.js';
import { makeSoldier, animateGait, bracketBox, makeSatellite } from './actors.js';
import { BARRIER_LINKS, SENSOR_POSTS, sensorPostXZ, ORBIT, LEO_SATS, SPY_SAT, COLORS } from '../layout.js';
import { makeRng } from './noise.js';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Microwave barrier
// ---------------------------------------------------------------------------
const BEAM_VERT = /* glsl */`
  varying vec3 vObj; varying vec3 vN; varying vec3 vV;
  void main() {
    vObj = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const BEAM_FRAG = /* glsl */`
  uniform vec3 uColor; uniform vec3 uAlert; uniform float uTime, uBreak, uOpacity, uLen;
  varying vec3 vObj; varying vec3 vN; varying vec3 vV;
  void main() {
    float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    // Wavefronts travelling from the transmitter (x = -1) to the receiver (x = +1).
    float along = (vObj.x * 0.5 + 0.5) * uLen;
    float wave = smoothstep(0.75, 1.0, fract(along / 6.0 - uTime * 1.6));
    vec3 col = mix(uColor, uAlert, uBreak);
    float a = (0.06 + pow(rim, 2.4) * 0.55 + wave * 0.22 * (1.0 - uBreak * 0.5)) * uOpacity;
    gl_FragColor = vec4(col * (0.7 + wave * 0.8), a);
  }`;

/** Barrier mast: `heads` lists the directions (radians) its antennas face. */
function barrierUnit(mastH, heads) {
  const g = new THREE.Group();
  g.name = 'Barrier_Unit';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, mastH, 10), mat('MAT_PowderCoat_Grey'));
  pole.position.y = mastH / 2;
  pole.castShadow = true;
  g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.14, 12), mat('MAT_Concrete'));
  base.position.y = 0.07;
  g.add(base);
  for (const { dir, kind } of heads) {
    const arm = new THREE.Group();
    arm.rotation.y = dir;
    const head = roundedBox(0.34, 0.34, 0.2, 0.03, mat('MAT_Polycarbonate_White'));
    head.position.set(0, mastH, 0.16);
    head.name = `Barrier_${kind}_Head`;
    // Coloured band: transmitter amber, receiver cyan.
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.21),
      matClone(kind === 'TX' ? 'MAT_LED_Amber' : 'MAT_LED_Blue'));
    band.position.set(0, mastH - 0.2, 0.16);
    arm.add(head, band);
    g.add(arm);
  }
  g.userData = { system: 'geofence' };
  return g;
}

export class BarrierNetwork {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'ZONE_MicrowaveBarrier';
    this.links = [];      // physical TX→RX links (line of sight, ~20–25 m)
    this.sections = [];   // per post pair, as reported to command
    const rng = makeRng(5150);
    const SPACING = 22;
    const HEAD = 1.6;     // antenna height above ground on level terrain

    // Unit sites along the post line, each post pair split into short hops so
    // every link has line of sight over the ridge terrain.
    const sites = [];
    for (const [i, j] of BARRIER_LINKS) {
      const a = sensorPostXZ(i), b = sensorPostXZ(j);
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / SPACING));
      for (let k = 0; k < n; k++) {
        const t = k / n;
        sites.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, section: i });
      }
      if (j === BARRIER_LINKS[BARRIER_LINKS.length - 1][1]) sites.push({ x: b.x, z: b.z, section: i });
    }
    // The barrier line runs 2.5 m inside the sensor posts, clear of their bases.
    for (const s of sites) { s.x -= 2.5; s.gy = terrainHeight(s.x, s.z); s.h = HEAD; }

    // Raise masts until each hop clears the ground by 0.8 m along its length.
    for (let pass = 0; pass < 3; pass++) {
      for (let k = 0; k < sites.length - 1; k++) {
        const a = sites[k], b = sites[k + 1];
        let need = 0;
        for (let s = 1; s < 16; s++) {
          const t = s / 16;
          const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
          const lineY = (a.gy + a.h) * (1 - t) + (b.gy + b.h) * t;
          need = Math.max(need, terrainHeight(x, z) + 0.8 - lineY);
        }
        if (need > 0) { a.h += need; b.h += need; }
      }
    }

    for (let k = 0; k < sites.length; k++) {
      const s = sites[k];
      const heads = [];
      if (k > 0) heads.push({ dir: Math.atan2(sites[k - 1].x - s.x, sites[k - 1].z - s.z), kind: 'RX' });
      if (k < sites.length - 1) heads.push({ dir: Math.atan2(sites[k + 1].x - s.x, sites[k + 1].z - s.z), kind: 'TX' });
      const unit = barrierUnit(s.h, heads);
      unit.position.set(s.x, s.gy, s.z);
      this.group.add(unit);
    }

    for (let k = 0; k < sites.length - 1; k++) {
      const a = sites[k], b = sites[k + 1];
      const pTx = new THREE.Vector3(a.x, a.gy + a.h, a.z);
      const pRx = new THREE.Vector3(b.x, b.gy + b.h, b.z);
      const axis = pRx.clone().sub(pTx);
      const L = axis.length();
      // Detection zone: the ellipsoid between the two antennas, waist set by
      // the antenna beamwidth (drawn at 1.4 m).
      const radius = 1.4;
      const material = new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color(COLORS.sensor) },
          uAlert: { value: new THREE.Color(COLORS.alert) },
          uTime: { value: 0 }, uBreak: { value: 0 }, uOpacity: { value: 0.75 }, uLen: { value: L },
        },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        side: THREE.DoubleSide,
      });
      const zone = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 14), material);
      zone.scale.set(L / 2, radius, radius);
      zone.position.copy(pTx).lerp(pRx, 0.5);
      zone.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), axis.clone().normalize());
      zone.userData.noPick = true;
      zone.renderOrder = 5;
      this.group.add(zone);
      this.links.push({
        section: a.section, pTx, pRx, L, radius, zone, material,
        base: -46 - rng() * 8, rssi: -50, broken: 0,
      });
    }

    BARRIER_LINKS.forEach(([i, j], idx) => {
      const own = this.links.filter((l) => l.section === i);
      this.sections.push({
        id: `${SENSOR_POSTS[i].id}→${SENSOR_POSTS[j].id}`, links: own,
        pTx: own[0].pTx, pRx: own[own.length - 1].pRx,
        rssi: -50, base: -50, broken: 0, hist: [], hops: own.length, index: idx,
      });
    });
  }

  /**
   * Received level (dBm) with an obstruction at `p` (or null). A body inside
   * the ellipsoid absorbs and scatters the beam; loss falls off smoothly with
   * distance from the axis relative to the zone's local radius.
   */
  measure(link, p, t) {
    let loss = 0;
    if (p) {
      const ab = link.pRx.clone().sub(link.pTx);
      const u = THREE.MathUtils.clamp(p.clone().sub(link.pTx).dot(ab) / ab.lengthSq(), 0, 1);
      const closest = link.pTx.clone().addScaledVector(ab, u);
      const d = closest.distanceTo(p);
      const w = 2 * u - 1;
      const localR = Math.max(0.3, link.radius * Math.sqrt(Math.max(0.02, 1 - w * w)));
      loss = 19 * Math.exp(-1.4 * (d / localR) ** 2);
    }
    const noise = Math.sin(t * 7.1 + link.base) * 0.35 + Math.sin(t * 2.3 + link.L) * 0.25;
    return link.base - loss + noise;
  }

  update(dt, t, obstruction) {
    for (const link of this.links) {
      link.rssi = this.measure(link, obstruction, t);
      const drop = link.base - link.rssi;
      const breakNow = drop > 6 ? 1 : 0;
      link.broken += (breakNow - link.broken) * Math.min(1, dt * 6);
      link.material.uniforms.uTime.value = t;
      link.material.uniforms.uBreak.value = link.broken;
    }
    // Each section reports its worst hop.
    for (const s of this.sections) {
      let worst = s.links[0];
      for (const l of s.links) if (l.base - l.rssi > worst.base - worst.rssi) worst = l;
      s.rssi = worst.rssi;
      s.base = worst.base;
      s.broken = Math.max(...s.links.map((l) => l.broken));
      s._acc = (s._acc || 0) + dt;
      if (s._acc > 0.1) {
        s._acc = 0;
        s.hist.push(s.rssi);
        if (s.hist.length > 120) s.hist.shift();
      }
    }
  }

  setOpacity(k) {
    for (const l of this.links) l.material.uniforms.uOpacity.value = k;
  }
}

// ---------------------------------------------------------------------------
// Intruder: approaches, climbs the fence, drops inside, walks into the beam
// ---------------------------------------------------------------------------
export class Intruder {
  constructor(scene) {
    this.fig = makeSoldier({ name: 'INTRUDER', raiseArm: false });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a2a26', roughness: 0.95 });
    this.fig.traverse((o) => {
      if (o.isMesh && (o.material === mat('MAT_ArmyFabric') || o.material === mat('MAT_FabricTan'))) o.material = dark;
    });
    this.fig.visible = false;
    this.fig.name = 'Intruder';
    this.bracket = bracketBox(1.4, 2.0, 1.2, COLORS.alert);
    this.bracket.position.y = 1.0;
    this.bracket.visible = false;
    this.fig.add(this.bracket);
    scene.add(this.fig);
    this.phase = 0;
    this.state = 'hidden';
  }

  /** Waypoints on the ground: start (outside), fence, stop (inside). */
  start(startXZ, fenceXZ, stopXZ) {
    this.a = startXZ; this.f = fenceXZ; this.b = stopXZ;
    this.pos = new THREE.Vector3(startXZ.x, terrainHeight(startXZ.x, startXZ.z), startXZ.z);
    this.state = 'approach';
    this.t = 0;
    this.fig.visible = true;
    this.bracket.visible = false;
    this.speed = 0;
  }

  hide() { this.state = 'hidden'; this.fig.visible = false; }

  get chest() {
    return this.fig.visible ? this.fig.position.clone().add(new THREE.Vector3(0, 1.1, 0)) : null;
  }

  moveToward(target, speed, dt) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const step = Math.min(d, speed * dt);
    if (d > 1e-3) {
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
      this.fig.rotation.y = Math.atan2(dx, dz);
    }
    this.pos.y = terrainHeight(this.pos.x, this.pos.z);
    return d - step;
  }

  update(dt) {
    if (this.state === 'hidden') return;
    this.t += dt;
    const G = 9.81;
    let lift = 0;
    if (this.state === 'approach') {
      this.speed = 1.3;
      if (this.moveToward(this.f, this.speed, dt) < 0.05) { this.state = 'climb'; this.t = 0; }
    } else if (this.state === 'climb') {
      // Climb the 3 m chain-link: hands and feet, ~0.9 m/s vertical.
      this.speed = 0;
      lift = Math.min(3.1, this.t * 0.9);
      if (this.t > 3.6) {
        this.state = 'drop'; this.t = 0;
        this.dropFrom = this.pos.clone();
        this.dropFrom.y += 3.1;
        const dx = this.b.x - this.pos.x, dz = this.b.z - this.pos.z;
        const d = Math.hypot(dx, dz);
        this.dropDir = { x: dx / d, z: dz / d };
      }
    } else if (this.state === 'drop') {
      // Free fall from the top of the fence: y = y0 − ½ g t², small forward push.
      const x = this.dropFrom.x + this.dropDir.x * 1.2 * this.t;
      const z = this.dropFrom.z + this.dropDir.z * 1.2 * this.t;
      const gy = terrainHeight(x, z);
      const y = this.dropFrom.y - 0.5 * G * this.t * this.t;
      this.pos.set(x, Math.max(gy, y), z);
      if (y <= gy) { this.state = 'enter'; this.t = 0; }
    } else if (this.state === 'enter') {
      this.speed = this.t < 0.5 ? 0 : 1.5;
      if (this.moveToward(this.b, this.speed, dt) < 0.05) this.state = 'hold';
    } else if (this.state === 'hold') {
      this.speed = 0;
    }
    this.phase += (this.speed * dt / 1.4) * Math.PI * 2;
    const bob = animateGait(this.fig, this.phase, this.speed);
    const crouch = this.state === 'approach' ? -0.12 : 0;
    this.fig.position.set(this.pos.x, this.pos.y + lift + bob + crouch, this.pos.z);
    if (this.state === 'climb') this.fig.rotation.x = -0.15;
  }
}

// ---------------------------------------------------------------------------
// Space segment: LEO passes, uncatalogued object, station tracking beam
// ---------------------------------------------------------------------------
function glintSprite(color = '#ffffff', size = 16) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  sp.scale.setScalar(size);
  sp.userData.noPick = true;
  return sp;
}

/** Imaging satellite with a nadir telescope. Not modelled on any real design. */
export function makeReconSatellite() {
  const g = new THREE.Group();
  g.name = 'Satellite_Uncatalogued';
  const foil = new THREE.MeshStandardMaterial({ color: '#8a6a2c', metalness: 0.9, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1d2126', metalness: 0.6, roughness: 0.4 });
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 22, 8), foil);
  g.add(bus);
  // Telescope barrel pointing at the ground (-Y), black baffle aperture.
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 16, 24), dark);
  barrel.position.y = -19;
  g.add(barrel);
  const aperture = new THREE.Mesh(new THREE.CircleGeometry(5.6, 24), new THREE.MeshBasicMaterial({ color: '#020304' }));
  aperture.rotation.x = Math.PI / 2;
  aperture.position.y = -27.1;
  g.add(aperture);
  const panelMat = new THREE.MeshStandardMaterial({ color: '#2a1a3a', metalness: 0.6, roughness: 0.3, emissive: '#12081c', emissiveIntensity: 0.5 });
  for (const s of [-1, 1]) {
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 8, 8), mat('MAT_StainlessSteel'));
    boom.rotation.z = Math.PI / 2;
    boom.position.x = s * 13;
    g.add(boom);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 11), panelMat);
    panel.position.x = s * 30;
    g.add(panel);
  }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 12, 6), mat('MAT_StainlessSteel'));
  ant.position.set(4, 16, 0);
  g.add(ant);
  g.userData.system = 'satellite';
  return g;
}

export class Constellation {
  constructor(scene, station) {
    this.group = new THREE.Group();
    this.group.name = 'ZONE_SpaceSegment';
    scene.add(this.group);
    this.C = new THREE.Vector3(...ORBIT.centre);
    this.station = station.clone();
    this.sats = [];
    for (const spec of LEO_SATS) this.sats.push(this.makeOrbiter(spec, false));
    this.spy = this.makeOrbiter(SPY_SAT, true);
    this.spy.mesh.visible = false;
    this.spy.track.visible = false;
    this.spy.label.visible = false;
    this.time = 0;
    this.buildBeams();
  }

  makeOrbiter(spec, isSpy) {
    const r = ORBIT.earthR + spec.alt;
    const omega = ORBIT.omega0 * Math.pow(ORBIT.r0 / r, 1.5);  // Kepler III
    const az = spec.az * DEG, tilt = spec.tilt * DEG;
    const uh = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
    const ph = new THREE.Vector3(-uh.z, 0, uh.x);
    const v = new THREE.Vector3(0, 1, 0).multiplyScalar(Math.cos(tilt)).addScaledVector(ph, Math.sin(tilt));
    const o = { spec, r, omega, uh, v, phi: spec.phase ?? 0, isSpy };

    const mesh = isSpy ? makeReconSatellite() : makeSatellite(false);
    mesh.scale.setScalar(isSpy ? 0.5 : 0.36);
    mesh.name = `Satellite_${spec.id}`;
    mesh.traverse((m) => { if (m.material) m.material.fog = false; });
    const glint = glintSprite(isSpy ? '#ff6b5e' : '#dff3ff', isSpy ? 34 : 24);
    mesh.add(glint);
    glint.scale.divideScalar(mesh.scale.x);
    this.group.add(mesh);
    o.mesh = mesh;

    // Visible arc of the orbit (the pass), dashed.
    const pts = [];
    const cosMax = ORBIT.earthR / (r * Math.cos(tilt));
    const phiMax = Math.acos(Math.min(0.999, cosMax)) + 0.08;
    for (let i = 0; i <= 160; i++) pts.push(this.orbitPoint(o, -phiMax + (2 * phiMax * i) / 160));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const track = new THREE.Line(geo, new THREE.LineDashedMaterial({
      color: isSpy ? COLORS.alert : COLORS.satellite, dashSize: 26, gapSize: 16,
      transparent: true, opacity: isSpy ? 0.9 : 0.4, depthWrite: false, fog: false,
    }));
    track.computeLineDistances();
    track.userData.noPick = true;
    this.group.add(track);
    o.track = track;
    o.phiMax = phiMax;

    // Label sprite (always faces the camera).
    o.label = this.labelSprite(spec.id, isSpy ? '#ff5a4d' : '#9fdcff');
    this.group.add(o.label);
    return o;
  }

  labelSprite(text, color) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = 64;
    const ctx = cv.getContext('2d');
    // Background is sized to the text; the sprite is scaled to match.
    let sprite = null;
    const draw = (t, c) => {
      ctx.clearRect(0, 0, 512, 64);
      ctx.font = '700 24px ui-monospace, Menlo, monospace';
      const w = Math.min(512, ctx.measureText(t).width + 28);
      ctx.fillStyle = 'rgba(6,12,20,0.78)';
      ctx.fillRect(0, 12, w, 40);
      ctx.fillStyle = c;
      ctx.fillRect(0, 12, 5, 40);
      ctx.fillText(t, 14, 41);
      if (sprite) sprite.center.set(w / 1024, 0.5);
    };
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sprite.scale.set(240, 30, 1);
    draw(text, color);
    sprite.userData = { noPick: true, redraw: (t, c) => { draw(t, c); tex.needsUpdate = true; } };
    return sprite;
  }

  orbitPoint(o, phi) {
    return this.C.clone()
      .addScaledVector(o.uh, o.r * Math.sin(phi))
      .addScaledVector(o.v, o.r * Math.cos(phi));
  }

  buildBeams() {
    // Ground-station tracking beam (radar / optical pointing), unit length on +Y.
    // Narrow at the antenna, spreading toward the target.
    const beamGeo = new THREE.CylinderGeometry(14, 0.6, 1, 24, 1, true);
    beamGeo.translate(0, 0.5, 0);
    this.beamMat = new THREE.MeshBasicMaterial({
      color: COLORS.satellite, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    this.beam = new THREE.Mesh(beamGeo, this.beamMat);
    this.beam.userData.noPick = true;
    this.group.add(this.beam);

    // Imaging footprint of the uncatalogued satellite: nadir cone to the ground.
    const fpGeo = new THREE.ConeGeometry(1, 1, 40, 1, true);
    fpGeo.translate(0, -0.5, 0);
    this.footMat = new THREE.MeshBasicMaterial({
      color: COLORS.alert, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    this.footprint = new THREE.Mesh(fpGeo, this.footMat);
    this.footprint.userData.noPick = true;
    this.group.add(this.footprint);
    this.footRing = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64), this.footMat);
    this.footRing.rotation.x = -Math.PI / 2;
    this.footRing.userData.noPick = true;
    this.group.add(this.footRing);
    this.trackTarget = null;
    this.beamOn = 0;
    this.footOn = 0;
  }

  /** Azimuth / elevation / range of an orbiter as the station sees it. */
  look(o) {
    const d = o.mesh.position.clone().sub(this.station);
    const range = d.length();
    const el = Math.asin(d.y / range) / DEG;
    // North is -Z in the scene; azimuth measured clockwise from north.
    const az = ((Math.atan2(d.x, -d.z) / DEG) + 360) % 360;
    return { el, az, rangeKm: range * ORBIT.kmPerUnit };
  }

  /** Place the spy so it rises over the horizon `inSeconds` from now. */
  scheduleSpy(inSeconds) {
    const s = this.spy;
    s.phi = -(s.phiMax - 0.08) - s.omega * inSeconds;
    s.mesh.visible = true;
    s.label.visible = true;
    s.detected = false;
    s.track.visible = false;
    s.label.userData.redraw(s.spec.id + ' ?', '#ffb020');
  }

  hideSpy() {
    const s = this.spy;
    s.mesh.visible = false;
    s.label.visible = false;
    s.track.visible = false;
    this.trackTarget = null;
    this.footOn = 0;
  }

  markSpy() {
    const s = this.spy;
    s.detected = true;
    s.track.visible = true;
    s.label.userData.redraw(`${s.spec.id} · UNCATALOGUED`, '#ff5a4d');
  }

  update(dt, camera) {
    this.time += dt;
    const all = [...this.sats, this.spy];
    const down = new THREE.Vector3(0, -1, 0);
    for (const o of all) {
      o.phi += o.omega * dt;
      // Wrap so each satellite comes round again after its (compressed) orbit.
      if (o.phi > Math.PI) o.phi -= Math.PI * 2;
      const p = this.orbitPoint(o, o.phi);
      o.mesh.position.copy(p);
      // Nadir pointing: the payload side faces the Earth's centre.
      o.mesh.quaternion.setFromUnitVectors(down, this.C.clone().sub(p).normalize());
      const vis = p.y > terrainHeight(p.x, p.z) - 20;
      if (!o.isSpy) { o.mesh.visible = vis; o.label.visible = vis; }
      o.label.position.copy(p).add(new THREE.Vector3(0, 34, 0));
      o.look = this.look(o);
    }

    // Tracking beam from the station to the current target.
    const want = this.trackTarget && this.trackTarget.mesh.visible && this.trackTarget.look.el > 0 ? 1 : 0;
    this.beamOn += (want - this.beamOn) * Math.min(1, dt * 3);
    if (this.trackTarget) {
      const to = this.trackTarget.mesh.position;
      const dir = to.clone().sub(this.station);
      this.beam.position.copy(this.station);
      this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      this.beam.scale.set(1, dir.length(), 1);
    }
    this.beamMat.opacity = this.beamOn * (0.16 + Math.sin(this.time * 9) * 0.04);

    // Footprint under the uncatalogued satellite.
    const s = this.spy;
    const fpWant = s.detected && s.mesh.visible && s.look.el > 0 ? 1 : 0;
    this.footOn += (fpWant - this.footOn) * Math.min(1, dt * 2);
    if (s.mesh.visible) {
      const p = s.mesh.position;
      const nadir = this.C.clone().sub(p).normalize();
      // Intersect the nadir line with the ground (approximately).
      const hAbove = Math.max(50, p.y - 20);
      const gp = p.clone().addScaledVector(nadir, hAbove / Math.max(0.2, -nadir.y));
      const gy = terrainHeight(gp.x, gp.z);
      gp.y = gy;
      const len = p.distanceTo(gp);
      const radius = len * Math.tan(9 * DEG);  // sensor half-angle (illustrative)
      this.footprint.position.copy(p);
      this.footprint.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), gp.clone().sub(p).normalize());
      this.footprint.scale.set(radius, len, radius);
      this.footRing.position.set(gp.x, gy + 2, gp.z);
      this.footRing.scale.setScalar(radius);
      s.nadir = gp;
      s.footRadius = radius;
    }
    this.footMat.opacity = this.footOn * 0.22;
    this.footprint.visible = this.footRing.visible = this.footOn > 0.01;
  }

  /** Summary for the dashboards. */
  tracks() {
    const rows = [];
    for (const o of [...this.sats, this.spy]) {
      if (!o.mesh.visible || !o.look || o.look.el < 0) continue;
      rows.push({
        id: o.spec.id, el: o.look.el, az: o.look.az, range: o.look.rangeKm,
        catalogued: !o.isSpy, flagged: o.isSpy && o.detected, tracking: this.trackTarget === o,
      });
    }
    return rows.sort((a, b) => b.el - a.el);
  }
}
