// High-altitude Himalayan-style terrain: valley floor, right-hand forested ridge,
// snow-capped far ranges. Heights are analytic so any object can be sited on the
// surface with terrainHeight(x, z).

import * as THREE from 'three';
import { fbm, ridged, smoothstep, clamp, makeRng } from './noise.js';

// Graded construction pads. Terrain is flattened to `y` inside each box, so
// runways, aprons and equipment plinths sit on level ground.
export const PAD_ZONES = [
  { name: 'airbase', x: -190, z: 150, hx: 172, hz: 92, y: 6 },        // runway + apron
  { name: 'hangars', x: -190, z: 62, hx: 140, hz: 44, y: 8 },         // hangar line
  { name: 'instrument_field', x: -22, z: 102, hx: 82, hz: 58, y: 11 },// EFM + LDS field
  // The control room sits on a graded shelf on the ridge crest so it overlooks
  // the perimeter — and so it is not hidden behind the ridge from the overview.
  { name: 'tracking_station', x: 165, z: -12, hx: 56, hz: 48, y: 124 },
  { name: 'gate', x: 88, z: 205, hx: 36, hz: 28, y: 9 },              // border gate + translator
  { name: 'watchtower', x: 306, z: -88, hx: 18, hz: 18, y: 142 },
];

export const TERRAIN = {
  minX: -2600, maxX: 2600,
  minZ: -2900, maxZ: 1400,
  segX: 440, segZ: 400,
  snowLine: 155,
};

function padFlatten(x, z) {
  // Returns {weight, height} for graded construction pads (runway, aprons, base).
  let w = 0, h = 0;
  for (const p of PAD_ZONES) {
    const dx = Math.abs(x - p.x) / p.hx;
    const dz = Math.abs(z - p.z) / p.hz;
    const d = Math.max(dx, dz);
    const k = 1 - smoothstep(0.75, 1.25, d);
    if (k > w) { w = k; h = p.y; }
  }
  return { weight: w, height: h };
}

/** Ground height in metres at world (x, z). */
export function terrainHeight(x, z) {
  // Gentle valley floor.
  let h = 4 + fbm(x * 0.0022, z * 0.0022, 4) * 7 + fbm(x * 0.012, z * 0.012, 3) * 1.6;

  // Right-hand forested ridge carrying the perimeter line.
  const ridgeMask = smoothstep(20, 300, x) * (1 - smoothstep(-160, -620, z));
  h += ridgeMask * (44 + ridged(x * 0.0026 + 11, z * 0.0026 - 4, 4) * 110);

  // Left rocky buttress the observation party stands on.
  const leftMask = smoothstep(-180, -560, x) * (1 - smoothstep(-80, -560, z));
  h += leftMask * (52 + ridged(x * 0.0031 - 7, z * 0.0031 + 3, 4) * 150);

  // Far snow ranges, held well back and capped so sky stays in frame.
  const farMask = smoothstep(-820, -2300, z);
  const range = ridged(x * 0.0011 + 31, z * 0.0011 + 17, 5);
  const range2 = ridged(x * 0.0024 - 13, z * 0.0024 + 5, 3);
  h += Math.pow(farMask, 1.4) * (range * 430 + range2 * 48 + 30);

  // Mid-distance foothills that separate the valley from the ranges.
  const midMask = smoothstep(-260, -760, z) * (1 - smoothstep(-900, -1500, z));
  h += midMask * (ridged(x * 0.0026 + 2, z * 0.0026 - 9, 4) * 150);

  const pad = padFlatten(x, z);
  if (pad.weight > 0) h = h * (1 - pad.weight) + pad.height * pad.weight;
  return h;
}

/** Approximate surface normal via finite differences. */
export function terrainNormal(x, z, eps = 2) {
  const hL = terrainHeight(x - eps, z);
  const hR = terrainHeight(x + eps, z);
  const hD = terrainHeight(x, z - eps);
  const hU = terrainHeight(x, z + eps);
  return new THREE.Vector3(hL - hR, 2 * eps, hD - hU).normalize();
}

export function terrainSlope(x, z) {
  return 1 - terrainNormal(x, z, 6).y;
}

const ROCK_LOW = new THREE.Color('#5a5146');
const ROCK_HIGH = new THREE.Color('#857a6b');
const GRASS = new THREE.Color('#585b3c');
const SCRUB = new THREE.Color('#77704c');
const SNOW = new THREE.Color('#eef4f9');
const SNOW_SHADE = new THREE.Color('#c6d5e4');
const GRAVEL = new THREE.Color('#8a8375');

function surfaceColor(x, z, h, slope, target) {
  const tint = fbm(x * 0.01, z * 0.01, 3) * 0.5 + 0.5;
  if (h < 26) {
    target.copy(GRASS).lerp(SCRUB, tint);
    target.lerp(GRAVEL, smoothstep(0.12, 0.4, slope) * 0.75);
  } else {
    target.copy(ROCK_LOW).lerp(ROCK_HIGH, tint);
    target.lerp(SCRUB, (1 - smoothstep(26, 90, h)) * 0.55);
  }
  // Snow accumulates with altitude; sheer faces stay bare rock, which is what
  // gives the far ranges their streaked appearance.
  const altitude = smoothstep(TERRAIN.snowLine - 70, TERRAIN.snowLine + 150, h);
  const exposure = 1 - smoothstep(0.34, 0.86, slope) * 0.9;
  const drift = 0.75 + fbm(x * 0.004 + 17, z * 0.004 - 6, 3) * 0.55;
  const snowAmount = Math.min(1, altitude * exposure * drift);
  if (snowAmount > 0) {
    const s = SNOW.clone().lerp(SNOW_SHADE, 1 - tint);
    target.lerp(s, snowAmount);
  }
  return target;
}

export function buildTerrain(quality = 1) {
  const group = new THREE.Group();
  group.name = 'ENV_Terrain';

  const segX = Math.round(TERRAIN.segX * quality);
  const segZ = Math.round(TERRAIN.segZ * quality);
  const geo = new THREE.PlaneGeometry(
    TERRAIN.maxX - TERRAIN.minX,
    TERRAIN.maxZ - TERRAIN.minZ,
    segX, segZ,
  );
  geo.rotateX(-Math.PI / 2);
  geo.translate((TERRAIN.minX + TERRAIN.maxX) / 2, 0, (TERRAIN.minZ + TERRAIN.maxZ) / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
  }
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
    surfaceColor(x, z, h, 1 - nrm.getY(i), c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'ENV_Ground';
  mesh.receiveShadow = true;
  mesh.userData.noPick = true;
  group.add(mesh);

  return group;
}

/** Instanced conifers on plausible slopes and altitudes only. */
export function buildVegetation(count = 1400) {
  const group = new THREE.Group();
  group.name = 'ENV_Vegetation';
  const rng = makeRng(7781);

  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.42, 3.2, 5);
  trunkGeo.translate(0, 1.6, 0);
  const foliageGeo = new THREE.ConeGeometry(2.2, 9, 7);
  foliageGeo.translate(0, 7, 0);

  const trunkMat = new THREE.MeshStandardMaterial({ color: '#3b2f25', roughness: 0.95 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: '#2b3a26', roughness: 0.92 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, count);
  foliage.castShadow = true;
  trunks.castShadow = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const colorA = new THREE.Color('#2b3a26');
  const colorB = new THREE.Color('#3d4f2c');
  const tmpColor = new THREE.Color();

  let placed = 0, guard = 0;
  while (placed < count && guard < count * 40) {
    guard++;
    const x = -900 + rng() * 2000;
    const z = -900 + rng() * 1400;
    const h = terrainHeight(x, z);
    // Tree line: plausible band only, and never on the graded installation pads.
    if (h < 24 || h > 150) continue;
    if (terrainSlope(x, z) > 0.42) continue;
    let onPad = false;
    for (const p of PAD_ZONES) {
      if (Math.abs(x - p.x) < p.hx * 1.5 && Math.abs(z - p.z) < p.hz * 1.5) { onPad = true; break; }
    }
    if (onPad) continue;
    // Density falls off on the valley floor, rises on the wooded ridge.
    const density = smoothstep(24, 60, h) * (1 - smoothstep(110, 150, h));
    if (rng() > density * 0.95 + 0.05) continue;

    const s = 0.42 + rng() * 0.46;
    pos.set(x, h - 0.4, z);
    scale.set(s, s * (0.8 + rng() * 0.5), s);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
    m.compose(pos, q, scale);
    trunks.setMatrixAt(placed, m);
    foliage.setMatrixAt(placed, m);
    tmpColor.copy(colorA).lerp(colorB, rng());
    foliage.setColorAt(placed, tmpColor);
    placed++;
  }
  trunks.count = placed;
  foliage.count = placed;
  trunks.instanceMatrix.needsUpdate = true;
  foliage.instanceMatrix.needsUpdate = true;
  if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;
  trunks.userData.noPick = true;
  foliage.userData.noPick = true;
  group.add(trunks, foliage);
  return group;
}

/** Instanced boulders for foreground interest. */
export function buildRocks(count = 420) {
  const rng = makeRng(3312);
  const geo = new THREE.IcosahedronGeometry(1, 1);
  // Irregular, non-spherical boulders.
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const n = 0.72 + Math.abs(fbm(p.getX(i) * 2.1, p.getZ(i) * 2.1 + p.getY(i), 3)) * 0.8;
    p.setXYZ(i, p.getX(i) * n, p.getY(i) * n * 0.8, p.getZ(i) * n);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: '#6d665b', roughness: 0.97, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.name = 'ENV_Rocks';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.noPick = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const c = new THREE.Color();
  let placed = 0, guard = 0;
  while (placed < count && guard < count * 30) {
    guard++;
    const x = -1000 + rng() * 2200;
    const z = -800 + rng() * 1400;
    const h = terrainHeight(x, z);
    if (h > 210) continue;
    let onPad = false;
    for (const pz of PAD_ZONES) {
      if (Math.abs(x - pz.x) < pz.hx * 1.2 && Math.abs(z - pz.z) < pz.hz * 1.2) { onPad = true; break; }
    }
    if (onPad) continue;
    const s = 0.8 + rng() * 5.5;
    e.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.4);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, h + s * 0.25, z), q, new THREE.Vector3(s, s * 0.8, s * 1.1));
    mesh.setMatrixAt(placed, m);
    c.setHSL(0.09, 0.08, 0.3 + rng() * 0.18);
    mesh.setColorAt(placed, c);
    placed++;
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}
