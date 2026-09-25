// Personnel and moving assets: figures with the health watch, helicopters,
// a tracked drone, satellites with the coverage cone, and detection overlays.

import * as THREE from 'three';
import { mat, matClone } from './materials.js';
import { roundedBox, makeHealthWatch, makeAndroidDevice } from './devices.js';
import { terrainHeight } from './terrain.js';
import { SQUAD, DETECTIONS, SATELLITES, HELI_PATHS, DRONE_PATH, A, COLORS } from '../layout.js';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Personnel — presentation figures, correct human proportions, no unit-specific
// insignia or equipment.
// ---------------------------------------------------------------------------
export function makeSoldier(opts = {}) {
  const g = new THREE.Group();
  g.name = opts.name || 'Personnel';
  const fabric = mat('MAT_ArmyFabric');
  const gear = mat('MAT_FabricTan');
  const skin = mat('MAT_Skin');
  const black = mat('MAT_Rubber_Black');

  // Each leg hangs from a hip pivot so the walk cycle swings it from the hip.
  const legGeo = new THREE.CapsuleGeometry(0.075, 0.5, 4, 10);
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.name = 'Hip';
    hip.position.set(s * 0.11, 0.86, 0);
    const leg = new THREE.Mesh(legGeo, fabric);
    leg.position.set(0, -0.34, 0);
    leg.castShadow = true;
    leg.name = 'Leg';
    hip.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.26), black);
    boot.position.set(0, -0.8, 0.03);
    boot.name = 'Boot';
    hip.add(boot);
    g.add(hip);
    legs.push(hip);
  }

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.34, 4, 12), fabric);
  torso.position.y = 1.16;
  torso.scale.z = 0.72;
  torso.castShadow = true;
  torso.name = 'Torso';
  g.add(torso);

  const vest = roundedBox(0.36, 0.42, 0.24, 0.05, gear);
  vest.position.y = 1.19;
  vest.name = 'PlateCarrier';
  g.add(vest);

  const pack = roundedBox(0.3, 0.38, 0.18, 0.05, gear);
  pack.position.set(0, 1.2, -0.2);
  pack.name = 'Backpack';
  g.add(pack);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 10), skin);
  neck.position.y = 1.42;
  g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.098, 16, 14), skin);
  head.position.y = 1.52;
  head.scale.set(0.92, 1.08, 1);
  head.castShadow = true;
  head.name = 'Head';
  g.add(head);
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), fabric);
  helmet.position.y = 1.535;
  helmet.name = 'Helmet';
  g.add(helmet);

  // Arms: the left forearm is raised so the wrist device is visible.
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.26, 4, 10);
  const shoulderR = new THREE.Group();
  shoulderR.name = 'Shoulder_R';
  shoulderR.position.set(0.21, 1.33, 0.02);
  const armR = new THREE.Mesh(armGeo, fabric);
  armR.position.set(0, -0.16, 0);
  armR.rotation.z = 0.16;
  armR.name = 'Arm_R';
  shoulderR.add(armR);
  g.add(shoulderR);

  const armLUpper = new THREE.Mesh(armGeo, fabric);
  armLUpper.position.set(-0.21, 1.17, 0.02);
  armLUpper.rotation.z = -0.2;
  armLUpper.name = 'Arm_L_Upper';
  g.add(armLUpper);

  // Forearm is its own frame: everything worn or held is positioned along the
  // arm's local +Y, so the watch sits on the wrist however the arm is posed.
  const forearm = new THREE.Group();
  forearm.name = 'Forearm_L_Rig';
  forearm.position.set(-0.235, 1.0, 0.03);
  // +1.15 rad lifts the forearm forward-and-up into the "reading the watch"
  // pose; the relaxed arm hangs down (pi) instead.
  forearm.rotation.x = opts.raiseArm === false ? Math.PI - 0.12 : 1.15;
  const fa = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.2, 4, 10), fabric);
  fa.position.set(0, 0.11, 0);
  fa.name = 'Forearm_L';
  forearm.add(fa);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), skin);
  hand.position.set(0, 0.27, 0);
  hand.name = 'Hand_L';
  forearm.add(hand);
  g.add(forearm);

  if (opts.watch) {
    const watch = makeHealthWatch(opts.watchCanvas);
    watch.name = 'Wearable_Watch';
    // Back of the wrist: with the arm raised this puts the display face up,
    // where the wearer (and the presentation camera) can read it.
    watch.position.set(0, 0.185, -0.052);
    watch.rotation.y = Math.PI;
    watch.userData = { ...watch.userData, soldierId: opts.name, system: 'wearable' };
    forearm.add(watch);
    g.userData.watch = watch;

    // Viewing position for the wearable close-up: out along the face of the
    // display, clear of the torso. Rides the arm, so the pose can change.
    const camAnchor = new THREE.Object3D();
    camAnchor.name = 'Watch_CameraAnchor';
    camAnchor.position.set(0.1, 0.3, -0.46);
    forearm.add(camAnchor);
    g.userData.watchCamera = camAnchor;
  }
  if (opts.device) {
    const [dw, dh] = opts.deviceSize || [0.16, 0.25];
    const dev = makeAndroidDevice(opts.deviceCanvas, dw, dh);
    dev.name = opts.deviceSize ? 'Commander_Tablet' : 'Handheld_Device';
    dev.position.set(0.05, 0.33, -0.1);
    dev.rotation.set(-0.4, Math.PI + 0.2, 0.1);
    dev.userData = { ...dev.userData, system: opts.deviceSystem || 'translator' };
    forearm.add(dev);
    g.userData.device = dev;
  }

  g.userData = { ...g.userData, type: 'personnel', id: opts.name, legs, shoulderR, torso, forearm };
  return g;
}

/**
 * Gait cycle. `phase` advances with distance walked (one stride per ~1.5 m
 * walking, longer when running), `speed` in m/s sets swing amplitude and
 * forward lean — standing still returns the figure to its rest pose.
 */
export function animateGait(fig, phase, speed) {
  const u = fig.userData;
  if (!u.legs) return;
  const run = THREE.MathUtils.clamp((speed - 2) / 2, 0, 1);
  const amp = Math.min(1, speed / 1.4) * (0.42 + run * 0.28);
  const s = Math.sin(phase);
  u.legs[0].rotation.x = s * amp;
  u.legs[1].rotation.x = -s * amp;
  u.shoulderR.rotation.x = s * amp * 0.9;
  // Forward lean when running (local pitch, then heading).
  fig.rotation.order = 'YXZ';
  fig.rotation.x = run * 0.16;
  // Body bob: two per stride, a few centimetres, more when running. Returned
  // so the caller can add it to the ground height.
  return Math.abs(Math.cos(phase)) * (0.02 + run * 0.05) * Math.min(1, speed);
}

export function buildSquad(watchCanvas, tabletCanvas) {
  const g = new THREE.Group();
  g.name = 'ZONE_SoldierWearable';
  const members = [];
  SQUAD.forEach((s) => {
    // Patrol members walk with the arm down; SOLDIER 01 stands with the arm
    // raised, reading the watch, so the wearable close-up is unobstructed.
    const fig = makeSoldier({
      name: s.id, watch: s.watch, watchCanvas, raiseArm: s.patrol === undefined,
    });
    fig.position.set(s.x, terrainHeight(s.x, s.z), s.z);
    fig.rotation.y = s.facing;
    fig.userData.system = 'wearable';
    fig.userData.spec = s;
    fig.userData.gait = 0;
    g.add(fig);
    members.push(fig);
  });

  // Squad commander holding the monitoring tablet, watching the patrol.
  const commander = makeSoldier({
    name: 'COMMANDER', device: true, deviceCanvas: tabletCanvas,
    deviceSystem: 'wearable', deviceSize: [0.25, 0.17],
  });
  commander.position.set(A.commander.x, terrainHeight(A.commander.x, A.commander.z), A.commander.z);
  commander.rotation.y = -100 * DEG;
  commander.userData.system = 'wearable';
  g.add(commander);

  g.userData = { members, commander, tablet: commander.userData.device };
  return g;
}

/** The two figures at the gate using the translator application. */
export function buildTranslatorPair(canvas) {
  const g = new THREE.Group();
  g.name = 'ZONE_Translator';
  const { x, z } = A.gate;

  const ours = makeSoldier({ name: 'Post Commander', device: true, deviceCanvas: canvas, deviceSystem: 'translator' });
  ours.position.set(x - 2.6, terrainHeight(x - 2.6, z - 1), z - 1);
  ours.rotation.y = 100 * DEG;
  g.add(ours);

  // Counterpart representative — neutral uniform colours, no national insignia.
  const other = makeSoldier({ name: 'Counterpart Representative', raiseArm: false });
  other.traverse((o) => {
    if (o.isMesh && o.material === mat('MAT_ArmyFabric')) o.material = mat('MAT_PowderCoat_Grey');
  });
  other.position.set(x + 2.8, terrainHeight(x + 2.8, z - 1.6), z - 1.6);
  other.rotation.y = -80 * DEG;
  g.add(other);

  g.userData = { device: ours.userData.device, system: 'translator' };
  return g;
}

// ---------------------------------------------------------------------------
// Helicopters
// ---------------------------------------------------------------------------
export function makeHelicopter() {
  const g = new THREE.Group();
  g.name = 'Helicopter';
  const skin = new THREE.MeshStandardMaterial({ color: '#3c4a3f', metalness: 0.45, roughness: 0.55 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 4.4, 6, 16), skin);
  body.rotation.x = Math.PI / 2;
  body.scale.set(1, 1, 0.92);
  body.castShadow = true;
  body.name = 'Heli_Fuselage';
  g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.45, 16, 12), mat('MAT_Glass_Display'));
  nose.position.z = 3.1;
  nose.scale.set(0.95, 0.85, 1.3);
  nose.name = 'Heli_Canopy';
  g.add(nose);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.22, 7.5, 12), skin);
  boom.rotation.x = Math.PI / 2;
  boom.position.z = -6;
  boom.name = 'Heli_TailBoom';
  g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 1.6), skin);
  fin.position.set(0, 1.1, -9.3);
  g.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.9), skin);
  stab.position.set(0, 0.4, -8.6);
  g.add(stab);

  const rotorHub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10), mat('MAT_StainlessSteel'));
  rotorHub.position.y = 2.0;
  g.add(rotorHub);
  const mainRotor = new THREE.Group();
  mainRotor.position.y = 2.2;
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.08, 0.62), mat('MAT_Aluminium_Black'));
    blade.position.x = 0;
    blade.rotation.y = i * 45 * DEG;
    blade.geometry.translate(5.6, 0, 0);
    mainRotor.add(blade);
  }
  mainRotor.name = 'Heli_MainRotor';
  g.add(mainRotor);

  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.35, 1.1, -9.4);
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.3), mat('MAT_Aluminium_Black'));
    blade.rotation.x = i * 90 * DEG;
    tailRotor.add(blade);
  }
  tailRotor.name = 'Heli_TailRotor';
  g.add(tailRotor);

  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.4, 8), mat('MAT_StainlessSteel'));
    skid.rotation.x = Math.PI / 2;
    skid.position.set(s * 1.5, -1.9, 0);
    g.add(skid);
    for (const zz of [-1.4, 1.4]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.5, 6), mat('MAT_StainlessSteel'));
      strut.position.set(s * 1.1, -1.2, zz);
      strut.rotation.z = s * 0.3;
      g.add(strut);
    }
  }

  g.userData = { mainRotor, tailRotor, system: 'airbase' };
  return g;
}

export function buildAirAssets() {
  const g = new THREE.Group();
  g.name = 'ZONE_AirAssets';
  const helis = HELI_PATHS.map((path, i) => {
    const h = makeHelicopter();
    h.name = `Helicopter_0${i + 1}`;
    h.userData.path = path;
    g.add(h);
    return h;
  });
  g.userData = { helis };
  return g;
}

// ---------------------------------------------------------------------------
// Drone (tracked by the ground station)
// ---------------------------------------------------------------------------
export function makeDrone() {
  const g = new THREE.Group();
  g.name = 'Drone_Quadrotor';
  const shell = mat('MAT_Aluminium_Black');
  const body = roundedBox(1.5, 0.45, 2.0, 0.14, shell);
  body.name = 'Drone_Body';
  g.add(body);
  const rotors = [];
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.7, 8), shell);
    arm.position.set(sx * 0.7, 0, sz * 0.75);
    arm.rotation.set(sz * 0.6, 0, -sx * 0.6);
    arm.lookAt(sx * 1.7, 0.2, sz * 1.8);
    arm.rotateX(Math.PI / 2);
    g.add(arm);
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 10), shell);
    nacelle.position.set(sx * 1.45, 0.16, sz * 1.5);
    g.add(nacelle);
    const rotor = new THREE.Group();
    rotor.position.set(sx * 1.45, 0.34, sz * 1.5);
    for (let b = 0; b < 2; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.03, 0.18),
        new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 0.6, transparent: true, opacity: 0.55 }));
      blade.rotation.y = b * 90 * DEG;
      rotor.add(blade);
    }
    g.add(rotor);
    rotors.push(rotor);
  }
  const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), shell);
  gimbal.position.set(0, -0.32, 0.5);
  gimbal.name = 'Drone_Gimbal';
  g.add(gimbal);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 12), mat('MAT_Glass_Display'));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, -0.32, 0.74);
  g.add(lens);
  const nav = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), matClone('MAT_LED_Red'));
  nav.position.set(0, -0.2, -0.9);
  g.add(nav);

  g.userData = { rotors, path: DRONE_PATH, system: 'drone' };
  return g;
}

// ---------------------------------------------------------------------------
// Satellites + coverage cone with India footprint
// ---------------------------------------------------------------------------
const INDIA_MAP_URL = new URL('../../assets/india_map.png', import.meta.url).href;

function indiaTexture() {
  // Official national outline (assets/india_map.png), recoloured as a
  // coverage-footprint graphic. The source is grey fill, black borders, white
  // background; white becomes transparent, fill and borders take the HUD blues.
  const S = 1024;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;

  const img = new Image();
  img.onload = () => {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const k = S / Math.max(iw, ih);
    const w = Math.round(iw * k), h = Math.round(ih * k);
    const ox = Math.round((S - w) / 2), oy = Math.round((S - h) / 2);
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(img, ox, oy, w, h);
    // Mask the "Created with mapchart.net" credit in the bottom-right corner.
    ctx.clearRect(ox + w * 0.855, oy + h * 0.975, w * 0.145, h * 0.025);

    const data = ctx.getImageData(0, 0, S, S);
    const d = data.data;
    const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    for (let y = 0; y < S; y++) {
      const g = clamp((y - oy) / h);
      const fr = 24 - 12 * g, fg = 60 - 28 * g, fb = 96 - 40 * g;
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const srcA = d[i + 3] / 255;
        if (srcA === 0) continue;
        const L = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        const a = clamp((0.97 - L) / 0.08) * srcA;   // white -> transparent
        const t = clamp((0.8 - L) / 0.5);            // grey fill -> border
        d[i] = fr + (140 - fr) * t;
        d[i + 1] = fg + (205 - fg) * t;
        d[i + 2] = fb + (255 - fb) * t;
        d[i + 3] = 255 * a * (0.92 + 0.06 * t);
      }
    }
    ctx.putImageData(data, 0, 0);

    // Coverage hotspot over the Ladakh sector (Leh, ~77.6E 34.2N), located on
    // the source image as a fraction of its width and height.
    const hx = ox + w * 0.34, hy = oy + h * 0.168;
    const hot = ctx.createRadialGradient(hx, hy, 0, hx, hy, 70);
    hot.addColorStop(0, 'rgba(255,238,120,0.98)');
    hot.addColorStop(0.35, 'rgba(255,120,40,0.85)');
    hot.addColorStop(1, 'rgba(255,60,30,0)');
    ctx.fillStyle = hot;
    ctx.beginPath(); ctx.arc(hx, hy, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.strokeStyle = 'rgba(8,16,28,0.9)';
    ctx.lineWidth = 6;
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.strokeText('LADAKH SECTOR', hx + 40, hy - 14);
    ctx.fillText('LADAKH SECTOR', hx + 40, hy - 14);

    tex.needsUpdate = true;
  };
  img.src = INDIA_MAP_URL;
  return tex;
}

export function makeSatellite(withBeam) {
  const g = new THREE.Group();
  g.name = 'Satellite';
  const gold = new THREE.MeshStandardMaterial({ color: '#c9a44c', metalness: 0.85, roughness: 0.35 });
  const body = roundedBox(12, 12, 20, 1.2, gold);
  body.name = 'Sat_Bus';
  g.add(body);
  const panelMat = new THREE.MeshStandardMaterial({
    color: '#16336b', metalness: 0.6, roughness: 0.25, emissive: '#0a1a3a', emissiveIntensity: 0.4,
  });
  for (const s of [-1, 1]) {
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 10, 8), mat('MAT_StainlessSteel'));
    boom.rotation.z = Math.PI / 2;
    boom.position.x = s * 11;
    g.add(boom);
    for (let i = 0; i < 2; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 14), panelMat);
      panel.position.set(s * (28 + i * 23), 0, 0);
      panel.name = 'Sat_SolarArray';
      g.add(panel);
    }
  }
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(6, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.34),
    new THREE.MeshStandardMaterial({ color: '#e7ecef', metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }));
  dish.rotation.x = Math.PI * 0.86;
  dish.position.set(0, -8, 4);
  dish.name = 'Sat_Dish';
  g.add(dish);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 14, 6), mat('MAT_StainlessSteel'));
  ant.position.set(0, 10, -6);
  g.add(ant);

  if (withBeam) {
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x5fc8ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(130, 300, 44, 1, true), beamMat);
    beam.position.y = -155;
    beam.name = 'Sat_CoverageCone';
    beam.userData.noPick = true;
    g.add(beam);

    const map = new THREE.Mesh(
      new THREE.PlaneGeometry(190, 190),
      new THREE.MeshBasicMaterial({
        map: indiaTexture(), transparent: true, opacity: 0.92, depthWrite: false, fog: false,
      }),
    );
    map.position.y = -250;
    map.name = 'Sat_FootprintMap';
    map.userData.billboard = true;
    g.add(map);
    g.userData.map = map;
  }

  g.userData = { ...g.userData, system: 'satellite' };
  return g;
}

export function buildSatellites() {
  const g = new THREE.Group();
  g.name = 'ZONE_Satellites';
  const sats = SATELLITES.map((s, i) => {
    const sat = makeSatellite(s.beam);
    sat.name = `Satellite_${s.id}`;
    sat.position.set(...s.pos);
    // Space assets are drawn at presentation scale, as in the reference board.
    sat.scale.setScalar(0.42);
    sat.userData.home = new THREE.Vector3(...s.pos);
    sat.userData.phase = i * 2.1;
    g.add(sat);
    return sat;
  });
  g.userData = { sats };
  return g;
}

// ---------------------------------------------------------------------------
// Detection overlays (object / vehicle detection from the border sensors)
// ---------------------------------------------------------------------------
export function bracketBox(w, h, d, color) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, fog: false });
  const t = Math.min(w, h) * 0.06;
  const len = Math.min(w, h) * 0.32;
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    corners.push([sx, sy, sz]);
  }
  for (const [sx, sy, sz] of corners) {
    const bx = new THREE.Mesh(new THREE.BoxGeometry(len, t, t), m);
    bx.position.set(sx * (w / 2 - len / 2), sy * h / 2, sz * d / 2);
    const by = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), m);
    by.position.set(sx * w / 2, sy * (h / 2 - len / 2), sz * d / 2);
    const bz = new THREE.Mesh(new THREE.BoxGeometry(t, t, len), m);
    bz.position.set(sx * w / 2, sy * h / 2, sz * (d / 2 - len / 2));
    g.add(bx, by, bz);
  }
  return g;
}

export function buildDetections() {
  const g = new THREE.Group();
  g.name = 'ZONE_Detections';
  const items = [];
  for (const d of DETECTIONS) {
    const holder = new THREE.Group();
    holder.name = `Detection_${d.id}`;
    const y = terrainHeight(d.x, d.z);
    if (d.kind === 'person') {
      const fig = makeSoldier({ name: d.id, raiseArm: false });
      fig.traverse((o) => {
        if (o.isMesh && o.material === mat('MAT_ArmyFabric')) o.material = mat('MAT_FabricTan');
      });
      holder.add(fig);
      const bx = bracketBox(1.2, 1.9, 1.0, COLORS.alert);
      bx.position.y = 0.95;
      holder.add(bx);
      holder.userData.box = bx;
    } else {
      const v = new THREE.Group();
      const body = roundedBox(2.4, 1.6, 5.0, 0.2, mat('MAT_PowderCoat_Olive'));
      body.position.y = 1.6;
      const cab = roundedBox(2.3, 1.2, 2.0, 0.15, mat('MAT_PowderCoat_Olive'));
      cab.position.set(0, 2.6, 1.3);
      v.add(body, cab);
      for (const sx of [-1, 1]) for (const sz of [-1.6, 1.6]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), mat('MAT_Rubber_Black'));
        w.rotation.z = Math.PI / 2;
        w.position.set(sx * 1.2, 0.55, sz);
        v.add(w);
      }
      v.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      holder.add(v);
      const bx = bracketBox(3.4, 3.4, 6.0, COLORS.health);
      bx.position.y = 1.8;
      holder.add(bx);
      holder.userData.box = bx;
    }
    holder.position.set(d.x, y, d.z);
    holder.rotation.y = d.kind === 'vehicle' ? -0.9 : 2.2;
    holder.userData = { ...holder.userData, detection: d, system: 'border' };
    g.add(holder);
    items.push(holder);
  }
  g.userData = { items };
  return g;
}
