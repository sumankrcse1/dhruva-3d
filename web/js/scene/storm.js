// Thunderstorm physics and effects for the EFM / LDS stories.
//
// Electrostatics: the cell is modelled as the classic dipole — main negative
// charge low in the cloud (~6 km), main positive charge high (~10 km). The
// ground is a conductor, so each charge has an image charge below it and the
// vertical field (potential gradient) at a ground point a horizontal distance
// d away from a charge Q at height h is
//
//     PG = 2 k Q h / (h² + d²)^(3/2)
//
// Sign follows the atmospheric-electricity convention the field mill reports:
// fair weather is about +0.1 kV/m, and a negative cloud base overhead drives the
// reading strongly negative. At long range the upper positive charge dominates,
// which is why the field reverses sign as a storm approaches — the model
// reproduces that too.
//
// The site is compressed for the exhibition view: one scene metre horizontally
// stands for STORM_SCALE real metres, so ranges and arrival times are computed
// in real units from scene positions.

import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { makeRng } from './noise.js';

export const STORM_SCALE = 20;          // real metres per scene metre (horizontal)
export const K_COULOMB = 8.988e9;
export const C_LIGHT = 299792458;       // m/s
export const C_SOUND = 343;             // m/s
export const FAIR_WEATHER_PG = 0.12;    // kV/m
export const CLOUD_BASE_Y = 330;        // scene height of the cloud base

const H_NEG = 6000, H_POS = 10000;      // charge-centre heights, real metres
const Q_MAX = 40;                       // coulombs, typical main charge

/** Potential gradient (kV/m) at ground from one point charge. */
function pgFrom(q, h, dReal) {
  return (2 * K_COULOMB * q * h) / Math.pow(h * h + dReal * dReal, 1.5) / 1000;
}

// ---------------------------------------------------------------------------
// Shared textures
// ---------------------------------------------------------------------------
function puffTexture(seed = 7) {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const rng = makeRng(seed);
  for (let i = 0; i < 18; i++) {
    const r = 18 + rng() * 34;
    const x = s / 2 + (rng() - 0.5) * 50;
    const y = s / 2 + (rng() - 0.5) * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.42)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.14)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glyphTexture(text, color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(32, 32, 26, 0, Math.PI * 2); ctx.globalAlpha = 0.28; ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(32, 32, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 34);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Additive rim-lit shell, used for wavefronts (radio pulse, sound). */
export function wavefrontMaterial(color, opacity = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = pow(rim, 2.2) * uOpacity;
        gl_FragColor = vec4(uColor * (0.6 + rim), a);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, fog: false,
  });
}

// ---------------------------------------------------------------------------
// Storm cell: cloud, charge, rain, field lines
// ---------------------------------------------------------------------------
export class Storm {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'FX_StormCell';
    this.group.visible = false;
    scene.add(this.group);

    this.center = new THREE.Vector3(-900, CLOUD_BASE_Y, 62);
    this.wind = new THREE.Vector3(20, 0, 0);   // scene m/s (time compressed)
    this.maturity = 0;                          // 0..1 charge separation
    this.qNeg = 0; this.qPos = 0;
    this.opacity = 0;                           // fades the whole cell in/out
    this.active = false;
    this.rainRate = 0;

    // One persistent flash light, reused by every bolt: adding and removing
    // lights at run time would force every material to recompile mid-strike.
    this.flashLight = new THREE.PointLight('#cfdcff', 0, 0, 2);
    scene.add(this.flashLight);

    this.buildCloud();
    this.buildCharges();
    this.buildFieldLines();
    this.buildRain();
  }

  buildCloud() {
    const tex = puffTexture(31);
    const rng = makeRng(2718);
    this.cloud = new THREE.Group();
    this.cloudMats = {
      base: new THREE.SpriteMaterial({ map: tex, color: '#474d56', transparent: true, depthWrite: false, fog: false }),
      mid: new THREE.SpriteMaterial({ map: tex, color: '#8b929b', transparent: true, depthWrite: false, fog: false }),
      top: new THREE.SpriteMaterial({ map: tex, color: '#e4e8ec', transparent: true, depthWrite: false, fog: false }),
    };
    const add = (m, x, y, z, s) => {
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z);
      sp.scale.set(s, s * 0.8, 1);
      sp.userData.noPick = true;
      this.cloud.add(sp);
    };
    // Flat, dark base: where the negative charge sits and rain falls from.
    for (let i = 0; i < 46; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 210;
      add(this.cloudMats.base, Math.cos(a) * r, 10 + rng() * 40, Math.sin(a) * r * 0.8, 120 + rng() * 80);
    }
    // Towering updraft column.
    for (let i = 0; i < 44; i++) {
      const y = 50 + rng() * 240;
      const r = (140 - y * 0.2) * Math.sqrt(rng());
      const a = rng() * Math.PI * 2;
      add(y < 150 ? this.cloudMats.mid : this.cloudMats.top,
        Math.cos(a) * r, y, Math.sin(a) * r, 120 + rng() * 80);
    }
    // Anvil, sheared downwind by the upper-level wind.
    for (let i = 0; i < 34; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng());
      add(this.cloudMats.top, Math.cos(a) * r * 320 + 90, 290 + rng() * 45,
        Math.sin(a) * r * 190, 150 + rng() * 90);
    }
    this.group.add(this.cloud);
  }

  buildCharges() {
    this.chargeSprites = [];
    const neg = new THREE.SpriteMaterial({ map: glyphTexture('−', '#3fa9f5'), transparent: true, depthWrite: false, fog: false });
    const pos = new THREE.SpriteMaterial({ map: glyphTexture('+', '#ff5a4d'), transparent: true, depthWrite: false, fog: false });
    const gnd = new THREE.SpriteMaterial({ map: glyphTexture('+', '#ff9d2e'), transparent: true, depthWrite: false, fog: false });
    this.chargeMats = [neg, pos, gnd];
    const rng = makeRng(99);
    const ring = (m, n, radius, y, size, ground) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng() * 0.4;
        const r = radius * (0.35 + rng() * 0.65);
        const sp = new THREE.Sprite(m);
        sp.scale.setScalar(size);
        sp.userData = { ox: Math.cos(a) * r, oz: Math.sin(a) * r * 0.8, y, ground, noPick: true };
        this.group.add(sp);
        this.chargeSprites.push(sp);
      }
    };
    ring(neg, 16, 170, 45, 22, false);     // negative centre, lower cloud
    ring(pos, 12, 150, 250, 24, false);    // positive centre, upper cloud
    ring(gnd, 14, 150, 3, 9, true);        // induced positive charge on the ground
  }

  buildFieldLines() {
    // Thin lines with dashes flowing upward; they fade out near the camera so
    // they never turn into walls of light in a close-up.
    const N = 64;
    const pos = new Float32Array(N * 2 * 3);
    const along = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { along[i * 2] = 0; along[i * 2 + 1] = 1; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('along', new THREE.BufferAttribute(along, 1));
    this.fieldMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#8fd3ff') } },
      vertexShader: /* glsl */`
        attribute float along; varying float vAlong; varying float vDist; varying float vY;
        void main() {
          vAlong = along;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vY = wp.y;
          vDist = distance(cameraPosition, wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uOpacity; uniform vec3 uColor;
        varying float vAlong; varying float vDist; varying float vY;
        void main() {
          float f = fract(vY / 14.0 - uTime * 0.9);
          float dash = smoothstep(0.55, 0.85, f) * (1.0 - smoothstep(0.9, 1.0, f));
          float a = (0.18 + dash * 0.82) * uOpacity * smoothstep(40.0, 160.0, vDist);
          gl_FragColor = vec4(uColor * (1.0 + dash), a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    this.fieldLines = new THREE.LineSegments(geo, this.fieldMat);
    this.fieldLines.userData.noPick = true;
    this.fieldLines.frustumCulled = false;
    const rng = makeRng(404);
    this.fieldAnchors = Array.from({ length: N }, () => {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 190;
      return { ox: Math.cos(a) * r, oz: Math.sin(a) * r * 0.8 };
    });
    this.group.add(this.fieldLines);
  }

  buildRain() {
    const N = 5200;
    this.rainN = N;
    const pos = new Float32Array(N * 6);
    this.rainState = new Float32Array(N * 4); // ox, oz, y, groundY
    const rng = makeRng(77);
    this.rng = rng;
    for (let i = 0; i < N; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 165;
      this.rainState[i * 4] = Math.cos(a) * r;
      this.rainState[i * 4 + 1] = Math.sin(a) * r * 0.8;
      this.rainState[i * 4 + 2] = CLOUD_BASE_Y - rng() * 320;
      this.rainState[i * 4 + 3] = -1e9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color: '#a9bccd', transparent: true, opacity: 0, depthWrite: false, fog: true,
    }));
    this.rain.frustumCulled = false;
    this.rain.userData.noPick = true;
    this.group.add(this.rain);
  }

  /** Place the cell and set its development state. */
  reset(x, z, maturity) {
    this.center.set(x, CLOUD_BASE_Y, z);
    this.maturity = maturity;
    this.active = true;
    this.group.visible = true;
    for (let i = 0; i < this.rainN; i++) this.rainState[i * 4 + 3] = -1e9;
  }

  dismiss() { this.active = false; }

  /** Potential gradient (kV/m) the field mill would read at scene (x, z). */
  fieldAt(x, z) {
    if (this.opacity <= 0.001) return FAIR_WEATHER_PG;
    const d = Math.hypot(x - this.center.x, z - this.center.z) * STORM_SCALE;
    return FAIR_WEATHER_PG + (pgFrom(this.qNeg, H_NEG, d) + pgFrom(this.qPos, H_POS, d)) * this.opacity;
  }

  /** A strike neutralises part of the lower negative charge at once. */
  discharge(fraction = 0.45) {
    this.qNeg *= 1 - fraction;
  }

  update(dt, time, camera) {
    // Fade in while active, out when dismissed.
    const target = this.active ? 1 : 0;
    this.opacity += (target - this.opacity) * Math.min(1, dt * (this.active ? 0.8 : 0.5));
    if (!this.active && this.opacity < 0.01) { this.opacity = 0; this.group.visible = false; return; }

    this.center.addScaledVector(this.wind, dt);
    // Charge separation builds with maturity; after a strike the updraft
    // recharges the lower centre over roughly ten seconds.
    const qTarget = Q_MAX * this.maturity;
    this.qPos += (qTarget - this.qPos) * Math.min(1, dt * 0.5);
    this.qNeg += (-qTarget - this.qNeg) * Math.min(1, dt * 0.12);
    this.rainRate = this.opacity * THREE.MathUtils.smoothstep(this.maturity, 0.45, 0.9);

    const o = this.opacity;
    this.cloud.position.copy(this.center);
    this.cloudMats.base.opacity = 0.95 * o;
    this.cloudMats.mid.opacity = 0.9 * o;
    this.cloudMats.top.opacity = 0.85 * o;
    this.cloud.scale.setScalar(0.75 + this.maturity * 0.25);

    // Charge glyphs: strength follows the actual charge on each centre.
    const qn = Math.abs(this.qNeg) / Q_MAX, qp = this.qPos / Q_MAX;
    this.chargeMats[0].opacity = o * qn;
    this.chargeMats[1].opacity = o * qp;
    this.chargeMats[2].opacity = o * qn * 0.9;
    for (const sp of this.chargeSprites) {
      const u = sp.userData;
      const x = this.center.x + u.ox, z = this.center.z + u.oz;
      if (u.ground) {
        if (u.gy === undefined || Math.abs(u.gx - x) > 8) { u.gy = terrainHeight(x, z); u.gx = x; }
        sp.position.set(x, u.gy + u.y + 3, z);
        // Ground glyphs are a wide-view aid; hide them in close-ups.
        sp.visible = !camera || camera.position.distanceTo(sp.position) > 90;
      } else {
        sp.position.set(x, this.center.y + u.y, z);
      }
    }

    // Field lines from the induced ground charge up to the cloud base; the
    // dashes flow upward (the field points from + on the ground to − above).
    const fp = this.fieldLines.geometry.attributes.position.array;
    this.fieldAnchors.forEach((a, i) => {
      const x = this.center.x + a.ox, z = this.center.z + a.oz;
      // Ground height is cached per anchor and refreshed as the cell moves.
      if (a.gy === undefined || Math.abs(a.gx - x) > 8) { a.gy = terrainHeight(x, z); a.gx = x; }
      fp.set([x, a.gy + 0.5, z, x, this.center.y + 20, z], i * 6);
    });
    this.fieldLines.geometry.attributes.position.needsUpdate = true;
    this.fieldMat.uniforms.uOpacity.value = o * qn * 0.8;
    this.fieldMat.uniforms.uTime.value = time;

    this.updateRain(dt);
  }

  updateRain(dt) {
    const k = this.rainRate;
    this.rain.material.opacity = 0.42 * k;
    if (k <= 0.01) return;
    const pos = this.rain.geometry.attributes.position.array;
    const st = this.rainState;
    // Raindrops fall at their terminal velocity (~9 m/s) and drift with the
    // low-level wind; each streak is the distance covered during one exposure.
    const vy = 9 * 3.2;               // time-compressed like the storm motion
    const drift = this.wind.x * 0.35;
    const len = 2.4;
    for (let i = 0; i < this.rainN; i++) {
      const j = i * 4;
      if (st[j + 3] === -1e9) {
        // First frame after a reset: find the ground under this drop, keep its
        // random starting height so the column is already full of rain.
        st[j + 3] = terrainHeight(this.center.x + st[j], this.center.z + st[j + 1]);
        if (st[j + 2] < st[j + 3]) st[j + 2] = this.center.y - this.rng() * 40;
      }
      let y = st[j + 2] - vy * dt;
      if (y < st[j + 3]) {
        // Hit the ground: respawn at the cloud base, somewhere under the cell.
        const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * 165;
        st[j] = Math.cos(a) * r;
        st[j + 1] = Math.sin(a) * r * 0.8;
        st[j + 3] = terrainHeight(this.center.x + st[j], this.center.z + st[j + 1]);
        y = this.center.y - this.rng() * 8;
      }
      st[j + 2] = y;
      const x = this.center.x + st[j], z = this.center.z + st[j + 1];
      const o = i * 6;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      pos[o + 3] = x - drift * 0.05; pos[o + 4] = y + len; pos[o + 5] = z;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Lightning: stepped leader, return stroke, subsequent strokes
// ---------------------------------------------------------------------------
function jaggedPath(from, to, rng, stepMin = 7, stepMax = 16, wander = 0.55) {
  const pts = [from.clone()];
  const p = from.clone();
  let guard = 0;
  while (p.distanceTo(to) > stepMax && guard++ < 400) {
    const dir = to.clone().sub(p).normalize();
    dir.x += (rng() - 0.5) * wander * 2;
    dir.z += (rng() - 0.5) * wander * 2;
    dir.y -= rng() * 0.2;
    dir.normalize();
    p.addScaledVector(dir, stepMin + rng() * (stepMax - stepMin));
    pts.push(p.clone());
  }
  pts.push(to.clone());
  return pts;
}

function polylineTube(points, radius) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
  return new THREE.TubeGeometry(path, points.length * 2, radius, 5, false);
}

export class LightningBolt {
  constructor(scene, from, to, seed = 1, light) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'FX_Lightning';
    const rng = makeRng(seed);
    const main = jaggedPath(from, to, rng);
    this.parts = [];

    const core = new THREE.MeshBasicMaterial({
      color: '#eaf2ff', transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    const glow = new THREE.MeshBasicMaterial({
      color: '#7fa8ff', transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    this.core = core; this.glow = glow;
    const addChannel = (pts, r, delay, span) => {
      const g1 = polylineTube(pts, r);
      const g2 = polylineTube(pts, r * 4.5);
      const m1 = new THREE.Mesh(g1, core);
      const m2 = new THREE.Mesh(g2, glow);
      m1.userData.noPick = m2.userData.noPick = true;
      this.group.add(m1, m2);
      this.parts.push({ meshes: [m1, m2], delay, span, total: g1.index.count, total2: g2.index.count });
    };
    addChannel(main, 0.9, 0, 1);
    // Branches: side leaders that stop short of the ground.
    for (let b = 0; b < 7; b++) {
      const k = 0.1 + rng() * 0.6;
      const start = main[Math.floor(k * (main.length - 1))];
      const end = start.clone().add(new THREE.Vector3((rng() - 0.5) * 140, -(40 + rng() * 90), (rng() - 0.5) * 140));
      addChannel(jaggedPath(start, end, rng, 5, 11, 0.7), 0.4, k, 0.5);
    }

    // The return stroke lights the whole valley.
    this.light = light;
    this.light.position.copy(from).lerp(to, 0.4);

    // Attachment glow on the ground.
    const spot = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 10), core);
    spot.position.copy(to);
    this.group.add(spot);

    scene.add(this.group);
    this.t = 0;
    this.leaderTime = 0.9;     // slowed for visibility; real stepped leader ~20 ms
    this.attached = false;
    this.done = false;
    this.from = from; this.to = to;
  }

  /** Brightness envelope: return stroke + three subsequent strokes. */
  flash(t) {
    const strokes = [0, 0.16, 0.3, 0.52];
    let f = 0;
    for (const s of strokes) {
      const dt = t - s;
      if (dt >= 0) f = Math.max(f, Math.exp(-dt * 16) * (s === 0 ? 1 : 0.75));
    }
    return f;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    const t = this.t;
    if (t < this.leaderTime) {
      // Stepped leader: faint, flickering, working its way down in steps.
      const k = Math.floor((t / this.leaderTime) * 14) / 14;
      for (const p of this.parts) {
        const local = THREE.MathUtils.clamp((k - p.delay) / p.span, 0, 1);
        const n1 = Math.floor((p.total * local) / 30) * 30;
        const n2 = Math.floor((p.total2 * local) / 30) * 30;
        p.meshes[0].geometry.setDrawRange(0, n1);
        p.meshes[1].geometry.setDrawRange(0, n2);
      }
      this.core.opacity = 0.35 + Math.random() * 0.2;
      this.glow.opacity = 0.08;
      this.light.intensity = 0;
    } else {
      if (!this.attached) {
        this.attached = true;
        for (const p of this.parts) {
          p.meshes[0].geometry.setDrawRange(0, Infinity);
          p.meshes[1].geometry.setDrawRange(0, Infinity);
        }
        this.onAttach?.();
      }
      const f = this.flash(t - this.leaderTime);
      this.core.opacity = Math.min(1, f * 1.6);
      this.glow.opacity = f * 0.55;
      this.light.intensity = f * 600000;
      this.brightness = f;
      if (t - this.leaderTime > 1.4) this.dispose();
    }
  }

  dispose() {
    this.done = true;
    this.brightness = 0;
    this.light.intensity = 0;
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
}

// ---------------------------------------------------------------------------
// Expanding wavefronts: the radio pulse (sferic) and hooter sound
// ---------------------------------------------------------------------------
export class Wavefront {
  /** speed is the displayed speed in scene m/s; maxR where it fades out. */
  constructor(scene, origin, { color, speed, maxR, opacity = 0.55, ground = true }) {
    this.scene = scene;
    this.origin = origin.clone();
    this.speed = speed;
    this.maxR = maxR;
    this.r = 0.01;
    this.baseOpacity = opacity;
    this.mat = wavefrontMaterial(color, opacity);
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), this.mat);
    this.shell.position.copy(origin);
    this.shell.userData.noPick = true;
    scene.add(this.shell);
    if (ground) {
      this.ringMat = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      });
      this.ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), this.ringMat);
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.set(origin.x, terrainHeight(origin.x, origin.z) + 1.2, origin.z);
      this.ring.userData.noPick = true;
      scene.add(this.ring);
    }
    this.done = false;
  }

  update(dt) {
    if (this.done) return;
    this.r += this.speed * dt;
    const k = 1 - this.r / this.maxR;
    if (k <= 0) { this.dispose(); return; }
    this.shell.scale.setScalar(this.r);
    this.mat.uniforms.uOpacity.value = this.baseOpacity * Math.min(1, k * 2);
    if (this.ring) {
      this.ring.scale.setScalar(this.r);
      this.ringMat.opacity = 0.8 * Math.min(1, k * 2);
    }
  }

  dispose() {
    this.done = true;
    this.scene.remove(this.shell);
    this.shell.geometry.dispose();
    this.mat.dispose();
    if (this.ring) { this.scene.remove(this.ring); this.ring.geometry.dispose(); this.ringMat.dispose(); }
  }
}

// ---------------------------------------------------------------------------
// Time-of-arrival geometry
// ---------------------------------------------------------------------------
/**
 * Ground-plane hyperbola: every point P with |P−A| − |P−B| = dd (scene metres).
 * Returned as line segments, sampled by direction from A, clipped at maxR.
 * For a ray from A with unit direction u, |A + r u − B| = r − dd solves to
 * r = (dd² − |A−B|²) / (2 (u·(A−B) + dd)).
 */
export function hyperbolaSegments(A, B, dd, maxR = 1400, samples = 900) {
  const abx = A.x - B.x, abz = A.z - B.z;
  const ab2 = abx * abx + abz * abz;
  const pts = [];
  let prev = null;
  for (let i = 0; i <= samples; i++) {
    const th = (i / samples) * Math.PI * 2;
    const ux = Math.cos(th), uz = Math.sin(th);
    const den = 2 * (ux * abx + uz * abz + dd);
    let cur = null;
    if (Math.abs(den) > 1e-6) {
      const r = (dd * dd - ab2) / den;
      if (r > 0 && r - dd > 0 && r < maxR) cur = [A.x + ux * r, A.z + uz * r];
    }
    if (cur && prev && Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) < 60) pts.push(prev, cur);
    prev = cur;
  }
  return pts;
}

export function groundLine(segments, color, lift = 1.6) {
  const arr = new Float32Array(segments.length * 3);
  segments.forEach(([x, z], i) => arr.set([x, terrainHeight(x, z) + lift, z], i * 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color, transparent: true, opacity: 0.95, depthWrite: false, fog: false,
  }));
  line.userData.noPick = true;
  line.renderOrder = 6;
  return line;
}

/** Pulsing ground marker with a light pillar, for a located strike. */
export function strikeMarker(x, z, color = '#ffd24a') {
  const g = new THREE.Group();
  g.name = 'FX_StrikeMarker';
  const y = terrainHeight(x, z);
  const ringMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false,
  });
  for (const r of [6, 12, 20]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.8, r, 48), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 1.3, z);
    g.add(ring);
  }
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 90, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.35, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    }));
  pillar.position.set(x, y + 45, z);
  g.add(pillar);
  g.traverse((o) => { o.userData.noPick = true; });
  g.userData = { ringMat, pillar, born: 0 };
  return g;
}
