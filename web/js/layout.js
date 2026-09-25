// Single source of truth for where everything sits in the world.
// Scene modules, callout labels, data links and camera moves all read from here,
// so an anchor only ever has to be changed in one place.
//
// The installation footprint is deliberately compressed (roughly 600 x 500 m)
// so the whole ecosystem reads in one exhibition frame. It is a composition,
// not a proposed siting plan.

import * as THREE from 'three';
import { terrainHeight, PAD_ZONES } from './scene/terrain.js';

export { PAD_ZONES };

/** Ground point, optionally lifted by `lift` metres. */
export function ground(x, z, lift = 0) {
  return new THREE.Vector3(x, terrainHeight(x, z) + lift, z);
}

// --- Perimeter -------------------------------------------------------------
// Fictional perimeter line. Not a real deployment layout.
export const FENCE_PATH = [
  [-82, 286], [-22, 258], [50, 231], [88, 205], [132, 166],
  [181, 120], [221, 67], [252, 11], [288, -45], [332, -112], [388, -186],
];

// Restricted-zone geofence (the red dashed boundary in the reference image).
export const GEOFENCE = { cx: 221, cz: -25, rx: 95, rz: 76, wobble: 0.16 };

export function geofencePoints(segments = 128) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const r = 1 + Math.sin(t * 3.0) * GEOFENCE.wobble + Math.sin(t * 5.0 + 1.2) * GEOFENCE.wobble * 0.4;
    pts.push([GEOFENCE.cx + Math.cos(t) * GEOFENCE.rx * r, GEOFENCE.cz + Math.sin(t) * GEOFENCE.rz * r]);
  }
  return pts;
}

// --- Equipment anchors -----------------------------------------------------
export const A = {
  efm: { x: -54, z: 92 },
  lds: { x: 9, z: 108 },
  warning: { x: -95, z: 118 },
  command: { x: 165, z: -12 },
  commandDoor: { x: 165, z: 14 },
  gate: { x: 88, z: 205 },
  runway: { x: -190, z: 150 },
  hangars: { x: -190, z: 62 },
  wearable: { x: -296, z: 120 },
  watchtower: { x: 306, z: -88 },
  server: { x: 145, z: 5 },
  // Squad commander with the monitoring tablet, beside the patrol area.
  commander: { x: -292, z: 106 },
};

// Patrol loop walked by SOLDIER 02–05 (clear of the runway and the apron).
export const PATROL = { cx: -322, cz: 112, rx: 20, rz: 11 };

/** Point on the patrol loop `s` metres along it (counter-clockwise). */
export function patrolPoint(s) {
  // Ramanujan's ellipse perimeter, then an arc-length-uniform-enough angle.
  const { cx, cz, rx, rz } = PATROL;
  const h = ((rx - rz) ** 2) / ((rx + rz) ** 2);
  const P = Math.PI * (rx + rz) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  const a = ((((s % P) + P) % P) / P) * Math.PI * 2;
  return {
    x: cx + Math.cos(a) * rx, z: cz + Math.sin(a) * rz,
    // Heading of the direction of travel (figure's +Z forward).
    heading: Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz),
  };
}

// Perimeter sensor posts (border RX/TX nodes) placed along the fence line.
export const SENSOR_POSTS = [
  { id: 'BS-01', t: 0.14 }, { id: 'BS-02', t: 0.33 }, { id: 'BS-03', t: 0.48 },
  { id: 'BS-04', t: 0.62 }, { id: 'BS-05', t: 0.76 }, { id: 'BS-06', t: 0.9 },
];

// Distributed lightning-detection nodes (ANT-50 + LRX-1). Three geographically
// separated nodes so the network reads as a network.
export const LDN_NODES = [
  { id: 'NODE-01', x: 9, z: 108, label: 'ANT-50 / LRX-1 · Node 01' },
  { id: 'NODE-02', x: -258, z: -62, label: 'ANT-50 / LRX-1 · Node 02' },
  { id: 'NODE-03', x: 268, z: 108, label: 'ANT-50 / LRX-1 · Node 03' },
];

// Detection overlays shown on the command feed.
export const DETECTIONS = [
  { id: 'DET-01', kind: 'person', x: 118, z: 66, label: 'Detected Person' },
  { id: 'DET-02', kind: 'vehicle', x: 178, z: 29, label: 'Detected Vehicle' },
  { id: 'DET-03', kind: 'person', x: 259, z: -36, label: 'Detected Person' },
];

// Squad carrying the health-monitoring watch. Anonymised identifiers only.
// SOLDIER 01 stands reading the watch; 02–05 walk the patrol loop in file,
// `patrol` metres apart. `fitness` scales the heart-rate response to effort.
export const SQUAD = [
  { id: 'SOLDIER 01', x: -296, z: 120, watch: true, facing: -0.6, restHr: 70, fitness: 1.0 },
  { id: 'SOLDIER 02', patrol: 0, watch: true, restHr: 66, fitness: 0.95 },
  { id: 'SOLDIER 03', patrol: -5, watch: true, restHr: 72, fitness: 1.05 },
  { id: 'SOLDIER 04', patrol: -10, watch: true, restHr: 76, fitness: 1.38 },
  { id: 'SOLDIER 05', patrol: -15, watch: true, restHr: 68, fitness: 1.0 },
].map((s) => {
  if (s.patrol === undefined) return s;
  const p = patrolPoint(s.patrol);
  return { ...s, x: p.x, z: p.z, facing: p.heading };
});

// Microwave barrier: a transmitter at one post floods an ellipsoidal zone to
// the receiver at the next. Five links along the six perimeter posts.
export const BARRIER_LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];

/** Ground position of perimeter sensor post i (as sited by buildSensorPosts). */
export function sensorPostXZ(i) {
  const p = fencePoint(SENSOR_POSTS[i].t);
  return { x: p.x - 6, z: p.z };
}

// --- Space segment -----------------------------------------------------------
// Orbits are drawn around a compressed Earth (scene radius EARTH_R) whose
// centre is below the site, so passes rise and set over the horizon. Angular
// rate follows Kepler's third law, ω ∝ r^-1.5, from a reference rate at r0.
export const ORBIT = {
  earthR: 6000, centre: [60, -6000, -40], r0: 6900, omega0: 0.036,
  kmPerUnit: 0.6,        // scene metre -> km, for displayed ranges
};
export const LEO_SATS = [
  { id: 'CAT-40931', alt: 900, az: 20, tilt: 18, phase: -0.2 },
  { id: 'CAT-41876', alt: 1010, az: 112, tilt: -26, phase: 0.9 },
  { id: 'CAT-39088', alt: 860, az: 64, tilt: 34, phase: 2.2 },
  { id: 'CAT-43217', alt: 950, az: 158, tilt: -8, phase: 3.3 },
  { id: 'CAT-37744', alt: 980, az: 88, tilt: 12, phase: 4.4 },
  { id: 'CAT-44602', alt: 920, az: 136, tilt: 22, phase: 5.4 },
];
// Uncatalogued low orbiter used in the space-watch story.
// Tilt 0: its ground track passes straight over the site.
export const SPY_SAT = { id: 'UNK-0917', alt: 780, az: 34, tilt: 0 };

// --- Air assets ------------------------------------------------------------
// Geostationary communications satellite: it keeps station over the equator,
// so it stays fixed in the sky — the one satellite that should not move.
export const SATELLITES = [
  { id: 'GSAT-LINK', pos: [38, 268, -372], beam: true },   // carries the coverage cone
];

export const HELI_PATHS = [
  { radius: 126, height: 96, center: [-116, 6], speed: 0.05, phase: 0 },
  { radius: 106, height: 124, center: [100, -88], speed: -0.062, phase: 2.1 },
];

export const DRONE_PATH = { radius: 84, height: 118, center: [212, -26], speed: 0.13 };

// --- Camera poses ----------------------------------------------------------
// pos/target in metres. Mirrors the Blender CAM_xx set.
export const VIEWS = {
  master: { pos: [6, 148, 468], target: [62, 34, -70], fov: 45 },
  efm: { pos: [-38, 13, 110], target: [-54, 9, 92], fov: 34 },
  lightning: { pos: [25, 13, 126], target: [9, 8, 108], fov: 34 },
  network: { pos: [-22, 238, 356], target: [22, 34, -46], fov: 48 },
  warning: { pos: [-77, 12, 136], target: [-95, 8, 118], fov: 36 },
  wearable: { pos: [-284, 46, 138], target: [-295, 43, 120], fov: 32 },
  command: { pos: [168, 131, 56], target: [165, 126, -10], fov: 46 },
  // From inside the perimeter, looking along the line at the two figures.
  translator: { pos: [80, 10.6, 197.5], target: [88, 8, 204], fov: 40 },
  border: { pos: [96, 168, 196], target: [232, 96, -30], fov: 46 },
  drone: { pos: [104, 176, 128], target: [212, 118, -26], fov: 42 },
  satellite: { pos: [34, 168, 210], target: [38, 262, -352], fov: 52 },
  airbase: { pos: [-186, 70, 292], target: [-188, 12, 112], fov: 42 },
  architecture: { pos: [12, 330, 560], target: [58, 12, -120], fov: 46 },
};

// --- Shared palette --------------------------------------------------------
export const COLORS = {
  sensor: 0x27b4e8,     // sensor data links
  network: 0x4a7dff,    // network / backhaul
  warning: 0xff9d2e,    // caution
  alert: 0xff3b30,      // alert
  health: 0x2fd06a,     // soldier telemetry
  translation: 0x9b6bff, // translator
  satellite: 0x6fd2ff,
  gold: 0xd9a233,
};

/** Point at parameter t (0..1) along the fence polyline, on the ground. */
export function fencePoint(t, lift = 0) {
  const pts = FENCE_PATH;
  const total = pts.length - 1;
  const f = Math.min(0.9999, Math.max(0, t)) * total;
  const i = Math.floor(f);
  const k = f - i;
  const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k;
  const z = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k;
  return ground(x, z, lift);
}
