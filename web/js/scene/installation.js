// The fictional high-altitude installation: airbase, command post, perimeter,
// gate, watchtower, roads and vehicles. Layout is composed for the exhibition
// view and is not a proposed deployment design.

import * as THREE from 'three';
import { mat, matClone } from './materials.js';
import { roundedBox, makeDish, makeServerRack, makeDisplayPanel, makeRuggedLaptop } from './devices.js';
import { terrainHeight } from './terrain.js';
import { A, FENCE_PATH, geofencePoints, fencePoint, SENSOR_POSTS } from '../layout.js';
import { makeRng } from './noise.js';

const DEG = Math.PI / 180;

function place(obj, x, z, lift = 0, rotY = 0) {
  obj.position.set(x, terrainHeight(x, z) + lift, z);
  obj.rotation.y = rotY;
  return obj;
}

function box(w, h, d, material, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true; m.receiveShadow = true; m.name = name || 'Box';
  return m;
}

// ---------------------------------------------------------------------------
// Airbase: runway, aprons, hangars, aircraft, fuel farm
// ---------------------------------------------------------------------------
export function buildAirbase() {
  const g = new THREE.Group();
  g.name = 'ZONE_Airbase';
  const y = terrainHeight(A.runway.x, A.runway.z);

  // Runway (small strip) with centreline and threshold markings.
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(300, 30), mat('MAT_Asphalt'));
  runway.rotation.x = -Math.PI / 2;
  runway.position.set(A.runway.x, y + 0.06, A.runway.z);
  runway.receiveShadow = true;
  runway.name = 'Runway_Surface';
  g.add(runway);

  const paint = mat('MAT_RoadPaint');
  // Centreline and threshold bars, instanced (one draw call each).
  const markings = (geo, name, placements) => {
    const im = new THREE.InstancedMesh(geo, paint, placements.length);
    im.name = name;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    placements.forEach(([px, pz], i) => {
      m4.compose(new THREE.Vector3(px, y + 0.08, pz), q, new THREE.Vector3(1, 1, 1));
      im.setMatrixAt(i, m4);
    });
    g.add(im);
  };
  const centre = [];
  for (let i = -9; i <= 9; i++) centre.push([A.runway.x + i * 15, A.runway.z]);
  markings(new THREE.PlaneGeometry(9, 0.8), 'Runway_Centreline', centre);
  const thresholds = [];
  for (const end of [-1, 1]) {
    for (let k = -3; k <= 3; k++) thresholds.push([A.runway.x + end * 140, A.runway.z + k * 3.4]);
  }
  markings(new THREE.PlaneGeometry(11, 1.5), 'Runway_Threshold', thresholds);

  // Apron and taxiway linking runway to the hangar line.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(190, 46), mat('MAT_Concrete'));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(A.hangars.x, terrainHeight(A.hangars.x, A.hangars.z) + 0.05, A.hangars.z + 26);
  apron.receiveShadow = true;
  apron.name = 'Apron_Surface';
  g.add(apron);

  // Hangars: arched shelters.
  for (let i = 0; i < 3; i++) {
    const hx = A.hangars.x - 72 + i * 72;
    const hz = A.hangars.z;
    const hangar = new THREE.Group();
    hangar.name = `Hangar_0${i + 1}`;
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 10, 30, 22, 1, true, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: '#5b6154', metalness: 0.35, roughness: 0.65, side: THREE.DoubleSide }),
    );
    shell.rotation.z = Math.PI / 2;
    shell.rotation.y = Math.PI / 2;
    shell.position.y = 0.2;
    shell.castShadow = true; shell.receiveShadow = true;
    shell.name = 'Hangar_Shell';
    hangar.add(shell);
    const backWall = box(20, 10, 0.6, mat('MAT_BuildingWall'), 'Hangar_RearWall');
    backWall.position.set(0, 5, -15);
    hangar.add(backWall);
    const door = box(17, 8.4, 0.5, mat('MAT_RoofMetal'), 'Hangar_Door');
    door.position.set(0, 4.2, 14.8);
    hangar.add(door);
    place(hangar, hx, hz, 0);
    g.add(hangar);
  }

  // Two parked aircraft (generic delta-wing trainers — not a specific type).
  for (let i = 0; i < 2; i++) {
    const jet = makeAircraft();
    place(jet, A.hangars.x - 38 + i * 62, A.hangars.z + 34, 0.2, (i ? -12 : 8) * DEG);
    g.add(jet);
  }

  // Fuel farm + operations building.
  for (let i = 0; i < 2; i++) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 6, 22), mat('MAT_Polycarbonate_White'));
    tank.castShadow = true; tank.name = 'FuelTank';
    place(tank, A.runway.x - 132 + i * 12, A.runway.z - 54, 3);
    g.add(tank);
  }
  const ops = buildBuilding(24, 8, 13, 'Operations_Building');
  place(ops, A.runway.x + 96, A.runway.z - 52, 0, -6 * DEG);
  g.add(ops);

  // Helipad.
  const pad = new THREE.Mesh(new THREE.CircleGeometry(11, 32), mat('MAT_Concrete'));
  pad.rotation.x = -Math.PI / 2;
  place(pad, A.runway.x + 150, A.runway.z - 22, 0.07);
  pad.name = 'Helipad';
  g.add(pad);
  const hRing = new THREE.Mesh(new THREE.RingGeometry(8, 9, 40), paint);
  hRing.rotation.x = -Math.PI / 2;
  place(hRing, A.runway.x + 150, A.runway.z - 22, 0.09);
  hRing.name = 'Helipad_Ring';
  g.add(hRing);

  return g;
}

export function makeAircraft() {
  const g = new THREE.Group();
  g.name = 'Aircraft_Generic';
  const skin = new THREE.MeshStandardMaterial({ color: '#7e8b93', metalness: 0.6, roughness: 0.42 });
  const fuselage = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 12, 6, 16), skin);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.y = 2.2;
  fuselage.castShadow = true;
  fuselage.name = 'Aircraft_Fuselage';
  g.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 16), skin);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 2.2, 8.4);
  nose.name = 'Aircraft_Nose';
  g.add(nose);
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 3); wingShape.lineTo(7.5, -3.2); wingShape.lineTo(7.5, -4.6);
  wingShape.lineTo(0, -3.6); wingShape.lineTo(0, 3);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.35, bevelEnabled: false });
  for (const s of [1, -1]) {
    const wing = new THREE.Mesh(wingGeo, skin);
    wing.rotation.x = -Math.PI / 2;
    wing.scale.x = s;
    wing.position.set(0, 1.9, -1);
    wing.castShadow = true;
    wing.name = 'Aircraft_Wing';
    g.add(wing);
  }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 4), skin);
  fin.position.set(0, 4, -5.4);
  fin.name = 'Aircraft_Fin';
  g.add(fin);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: '#16212b', metalness: 0.5, roughness: 0.2 }));
  canopy.scale.set(1, 0.8, 2.4);
  canopy.position.set(0, 2.9, 4.2);
  canopy.name = 'Aircraft_Canopy';
  g.add(canopy);
  for (const s of [1, -1]) {
    const gear = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2, 8), mat('MAT_StainlessSteel'));
    gear.position.set(s * 2.4, 1.1, -0.5);
    g.add(gear);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.2, 8, 14), mat('MAT_Rubber_Black'));
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(s * 2.4, 0.42, -0.5);
    g.add(wheel);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Generic building shell
// ---------------------------------------------------------------------------
export function buildBuilding(w, h, d, name = 'Building', opts = {}) {
  const g = new THREE.Group();
  g.name = name;
  const walls = box(w, h, d, mat('MAT_BuildingWall'), `${name}_Walls`);
  walls.position.y = h / 2;
  g.add(walls);
  const roof = box(w + 1.4, 0.5, d + 1.4, mat('MAT_RoofMetal'), `${name}_Roof`);
  roof.position.y = h + 0.25;
  g.add(roof);
  const plinth = box(w + 2, 0.6, d + 2, mat('MAT_Concrete'), `${name}_Plinth`);
  plinth.position.y = 0.3;
  g.add(plinth);
  // Windows along the long face.
  const winMat = mat('MAT_Glass_Display');
  const n = opts.windows ?? Math.max(2, Math.floor(w / 6));
  for (let i = 0; i < n; i++) {
    const win = box(2.6, 1.5, 0.2, winMat, `${name}_Window_${i + 1}`);
    win.position.set(-w / 2 + (i + 0.5) * (w / n), h * 0.62, d / 2 + 0.02);
    g.add(win);
  }
  const door = box(2.2, 3, 0.2, mat('MAT_PowderCoat_Olive'), `${name}_Door`);
  door.position.set(0, 1.5, d / 2 + 0.05);
  g.add(door);
  return g;
}

// ---------------------------------------------------------------------------
// Command / tracking station (cutaway so the operator interior reads)
// ---------------------------------------------------------------------------
export function buildCommandPost(screens) {
  const g = new THREE.Group();
  g.name = 'ZONE_CommandPost';
  const { x, z } = A.command;
  const y = terrainHeight(x, z);
  const W = 32, H = 10.5, D = 22;

  const shell = new THREE.Group();
  shell.name = 'Command_Structure';
  // Three walls + roof, front left open as an exhibition cutaway.
  const back = box(W, H, 0.6, mat('MAT_BuildingWall'), 'Command_RearWall');
  back.position.set(0, H / 2, -D / 2);
  const left = box(0.6, H, D, mat('MAT_BuildingWall'), 'Command_SideWall_L');
  left.position.set(-W / 2, H / 2, 0);
  const right = box(0.6, H, D, mat('MAT_BuildingWall'), 'Command_SideWall_R');
  right.position.set(W / 2, H / 2, 0);
  const roof = box(W + 2, 0.7, D + 2, mat('MAT_RoofMetal'), 'Command_Roof');
  roof.position.set(0, H + 0.35, 0);
  const floor = box(W, 0.5, D, mat('MAT_Concrete'), 'Command_Floor');
  floor.position.set(0, 0.25, 0);
  const sill = box(W, 1.1, 0.6, mat('MAT_BuildingWall'), 'Command_FrontSill');
  sill.position.set(0, 0.55, D / 2);
  shell.add(back, left, right, roof, floor, sill);

  // Interior: wall display, console desks, workstation, rack.
  const wall = makeDisplayPanel(screens?.command, 12.5, 6.2);
  wall.position.set(0, 5.0, -D / 2 + 0.45);
  wall.name = 'Command_MainDisplay';
  shell.add(wall);

  const deskMat = mat('MAT_PowderCoat_Grey');
  for (let i = -1; i <= 1; i++) {
    const desk = box(7, 0.12, 1.5, deskMat, `Command_Console_${i + 2}`);
    desk.position.set(i * 7.6, 2.0, 1.8);
    shell.add(desk);
    const legA = box(0.14, 2, 1.2, deskMat, 'Console_Leg');
    legA.position.set(i * 7.6 - 3.2, 1.0, 1.8);
    const legB = legA.clone(); legB.position.x = i * 7.6 + 3.2;
    shell.add(legA, legB);
    // Operator monitors.
    for (const dx of [-2.1, 0, 2.1]) {
      const mon = makeDisplayPanel(i === 0 && dx === 0 ? screens?.efm : screens?.console, 1.7, 1.0);
      mon.position.set(i * 7.6 + dx, 2.75, 1.5);
      mon.rotation.y = -dx * 0.06;
      shell.add(mon);
    }
    const chair = new THREE.Group();
    const seat = box(0.9, 0.12, 0.9, mat('MAT_Rubber_Black'), 'Chair_Seat');
    seat.position.y = 1.1;
    const backRest = box(0.9, 1.1, 0.12, mat('MAT_Rubber_Black'), 'Chair_Back');
    backRest.position.set(0, 1.7, -0.42);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 10), deskMat);
    stem.position.y = 0.55;
    chair.add(seat, backRest, stem);
    chair.position.set(i * 7.6, 0.5, 3.4);
    chair.name = `Command_Chair_${i + 2}`;
    shell.add(chair);
  }

  const laptop = makeRuggedLaptop(screens?.console);
  laptop.position.set(7.0, 2.06, 2.0);
  laptop.scale.setScalar(2.6);
  shell.add(laptop);

  const rack = makeServerRack();
  rack.position.set(-11.2, 0.5, -6.0);
  rack.scale.setScalar(1.6);
  rack.name = 'Command_ProcessingRack';
  shell.add(rack);

  // Open face looks out over the valley, so the operator picture is readable
  // from the approach camera.
  place(shell, x, z, 0, 0);
  g.add(shell);

  // Communications mast with dishes and panel antennas.
  const mastG = new THREE.Group();
  mastG.name = 'Command_CommsMast';
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 26, 12), mat('MAT_PowderCoat_Grey'));
  mast.position.y = 13; mast.castShadow = true; mast.name = 'CommsMast_Tower';
  mastG.add(mast);
  for (let i = 0; i < 4; i++) {
    const arm = box(3.4, 0.2, 0.2, mat('MAT_StainlessSteel'), 'CommsMast_Arm');
    arm.position.set(0, 8 + i * 4.5, 0);
    arm.rotation.y = i * 40 * DEG;
    mastG.add(arm);
    const panel = roundedBox(0.5, 1.8, 0.24, 0.05, mat('MAT_Polycarbonate_White'));
    panel.position.set(Math.cos(i * 40 * DEG) * 1.7, 8 + i * 4.5, Math.sin(i * 40 * DEG) * 1.7);
    panel.name = `CommsMast_PanelAntenna_${i + 1}`;
    mastG.add(panel);
  }
  const beaconMat = matClone('MAT_LED_Red');
  const aviation = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), beaconMat);
  aviation.position.y = 26.4;
  aviation.name = 'CommsMast_ObstructionLight';
  mastG.add(aviation);
  mastG.userData.obstruction = beaconMat;
  place(mastG, x + 16, z - 6, 0);
  g.add(mastG);

  // Ground-station dishes (drone tracking / satellite link).
  const dish1 = makeDish(2.6);
  place(dish1, x - 20, z - 4, 0, 40 * DEG);
  dish1.name = 'GroundStation_Dish_01';
  g.add(dish1);
  const dish2 = makeDish(1.7);
  place(dish2, x - 26, z + 6, 0, 70 * DEG);
  dish2.name = 'GroundStation_Dish_02';
  g.add(dish2);

  // Sandbag revetment (instanced).
  const bagGeo = new THREE.CapsuleGeometry(0.28, 0.5, 4, 8);
  const bags = new THREE.InstancedMesh(bagGeo, mat('MAT_SandbagTan'), 132);
  bags.name = 'Command_SandbagRevetment';
  bags.castShadow = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
  let idx = 0;
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 18; i++) {
      const px = x - 13 + i * 1.5 + (row % 2) * 0.4;
      const pz = z + 15.5;
      m4.compose(new THREE.Vector3(px, terrainHeight(px, pz) + 0.3 + row * 0.5, pz),
        q, new THREE.Vector3(1, 1, 1));
      bags.setMatrixAt(idx++, m4);
    }
  }
  bags.count = idx;
  g.add(bags);

  g.userData = { obstructionLight: beaconMat, dishes: [dish1, dish2] };
  return g;
}

// ---------------------------------------------------------------------------
// Perimeter fence, geofence boundary, gate, watchtower
// ---------------------------------------------------------------------------
function chainLinkTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = 'rgba(190,198,205,0.95)';
  ctx.lineWidth = 3;
  for (let i = -64; i < 128; i += 12) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 64, 64); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 64); ctx.lineTo(i + 64, 0); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function buildPerimeter() {
  const g = new THREE.Group();
  g.name = 'ZONE_Perimeter';

  const tex = chainLinkTexture();
  const meshMat = new THREE.MeshStandardMaterial({
    map: tex, alphaMap: tex, transparent: true, alphaTest: 0.35,
    side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3, color: '#b9c2c9',
  });

  const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.1, 8);
  const posts = [];
  const segments = [];
  const STEP = 6; // metres between posts
  for (let i = 0; i < FENCE_PATH.length - 1; i++) {
    const [x1, z1] = FENCE_PATH[i];
    const [x2, z2] = FENCE_PATH[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const n = Math.max(2, Math.round(len / STEP));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const ax = x1 + (x2 - x1) * t0, az = z1 + (z2 - z1) * t0;
      const bx = x1 + (x2 - x1) * t1, bz = z1 + (z2 - z1) * t1;
      posts.push([ax, az]);
      segments.push([ax, az, bx, bz]);
    }
  }
  posts.push(FENCE_PATH[FENCE_PATH.length - 1]);

  const postMesh = new THREE.InstancedMesh(postGeo, mat('MAT_StainlessSteel'), posts.length);
  postMesh.name = 'Fence_Posts';
  postMesh.castShadow = true;
  const m4 = new THREE.Matrix4();
  posts.forEach(([px, pz], i) => {
    m4.makeTranslation(px, terrainHeight(px, pz) + 1.55, pz);
    postMesh.setMatrixAt(i, m4);
  });
  postMesh.instanceMatrix.needsUpdate = true;
  g.add(postMesh);

  // Fence mesh: one merged geometry for the whole run (each panel as a quad
  // that follows the ground), so the perimeter costs a single draw call.
  const pos = [];
  const uv = [];
  const idx = [];
  const H = 3;
  let v = 0;
  for (const [ax, az, bx, bz] of segments) {
    const len = Math.hypot(bx - ax, bz - az);
    const ya = terrainHeight(ax, az), yb = terrainHeight(bx, bz);
    pos.push(ax, ya, az, bx, yb, bz, ax, ya + H, az, bx, yb + H, bz);
    uv.push(0, 0, len / 3, 0, 0, 1, len / 3, 1);
    idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    v += 4;
  }
  const fenceGeo = new THREE.BufferGeometry();
  fenceGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fenceGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  fenceGeo.setIndex(idx);
  fenceGeo.computeVertexNormals();
  const fence = new THREE.Mesh(fenceGeo, meshMat);
  fence.name = 'Fence_Panels';
  g.add(fence);

  // Razor coil along the top.
  const topPts = posts.map(([px, pz]) => new THREE.Vector3(px, terrainHeight(px, pz) + 3.05, pz));
  const topCurve = new THREE.CatmullRomCurve3(topPts);
  const coil = new THREE.Mesh(
    new THREE.TubeGeometry(topCurve, topPts.length * 3, 0.07, 6, false),
    mat('MAT_StainlessSteel'),
  );
  coil.name = 'Fence_RazorCoil';
  g.add(coil);

  // Cleared strip at the foot of the fence. Chain-link all but vanishes at
  // overview distance; this keeps the perimeter legible from the wide camera.
  const strip = ribbonMesh(FENCE_PATH, 0.75,
    new THREE.MeshStandardMaterial({ color: '#4c4a43', roughness: 0.96 }), 0.1, 320);
  strip.name = 'Fence_BaseStrip';
  g.add(strip);

  return g;
}

/** Red dashed restricted-zone boundary drawn on the ground. */
export function buildGeofence() {
  const g = new THREE.Group();
  g.name = 'GEOFENCE_RestrictedZone';
  const pts = geofencePoints(220);
  const dashMat = matClone('MAT_LED_Red');
  dashMat.transparent = true;
  dashMat.opacity = 0.95;
  const geo = new THREE.PlaneGeometry(1, 1);
  const dashes = new THREE.InstancedMesh(geo, dashMat, pts.length);
  dashes.name = 'Geofence_Dashes';
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let idx = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    if (i % 2 === 1) continue; // dashed
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az) * 0.75;
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    e.set(-Math.PI / 2, 0, -Math.atan2(bz - az, bx - ax));
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(cx, terrainHeight(cx, cz) + 0.5, cz), q, new THREE.Vector3(len, 2.6, 1));
    dashes.setMatrixAt(idx++, m4);
  }
  dashes.count = idx;
  dashes.instanceMatrix.needsUpdate = true;
  g.add(dashes);
  g.userData = { dashMat };
  return g;
}

function flagTexture(kind) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 85;
  const ctx = cv.getContext('2d');
  if (kind === 'IN') {
    ctx.fillStyle = '#ff9933'; ctx.fillRect(0, 0, 128, 28.3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 28.3, 128, 28.3);
    ctx.fillStyle = '#138808'; ctx.fillRect(0, 56.6, 128, 28.4);
    ctx.strokeStyle = '#000080'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(64, 42.5, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(64, 42.5);
      ctx.lineTo(64 + Math.cos(a) * 11, 42.5 + Math.sin(a) * 11);
      ctx.stroke();
    }
  } else {
    // Counterpart post marker — plain colour field, no national emblem drawn.
    ctx.fillStyle = '#c8102e'; ctx.fillRect(0, 0, 128, 85);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFlag(kind) {
  const g = new THREE.Group();
  g.name = `Flag_${kind}`;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 9, 10), mat('MAT_StainlessSteel'));
  pole.position.y = 4.5; pole.castShadow = true; pole.name = 'Flag_Pole';
  g.add(pole);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 2.0, 12, 4),
    new THREE.MeshStandardMaterial({ map: flagTexture(kind), side: THREE.DoubleSide, roughness: 0.85 }),
  );
  cloth.position.set(1.5, 7.6, 0);
  cloth.name = 'Flag_Cloth';
  cloth.userData.wave = true;
  g.add(cloth);
  g.userData.cloth = cloth;
  return g;
}

export function buildGate(devices) {
  const g = new THREE.Group();
  g.name = 'ZONE_Gate';
  const { x, z } = A.gate;

  // Gate structure and lifting barrier.
  const pillarL = box(1.6, 5, 1.6, mat('MAT_Concrete'), 'Gate_Pillar_L');
  place(pillarL, x - 7, z + 2, 2.5);
  const pillarR = box(1.6, 5, 1.6, mat('MAT_Concrete'), 'Gate_Pillar_R');
  place(pillarR, x + 7, z + 2, 2.5);
  const lintel = box(16, 1.1, 1.2, mat('MAT_PowderCoat_Olive'), 'Gate_Lintel');
  place(lintel, x, z + 2, 5.4);
  g.add(pillarL, pillarR, lintel);

  const barrier = new THREE.Group();
  barrier.name = 'Gate_Barrier';
  const arm = box(11, 0.22, 0.26, mat('MAT_RoadPaint'), 'Barrier_Arm');
  arm.position.x = 5.2;
  const stripes = new THREE.Mesh(new THREE.BoxGeometry(11, 0.24, 0.1), matClone('MAT_LED_Red'));
  stripes.material.emissiveIntensity = 0.7;
  stripes.position.set(5.2, 0, 0.14);
  barrier.add(arm, stripes);
  place(barrier, x - 5, z - 3, 1.6, 4 * DEG);
  g.add(barrier);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.7, 12), mat('MAT_PowderCoat_Grey'));
  place(post, x - 5, z - 3, 0.85);
  post.name = 'Barrier_Post';
  g.add(post);

  // Flags either side of the line.
  const fIN = makeFlag('IN');
  place(fIN, x - 13, z + 4, 0, 0);
  const fOther = makeFlag('OTHER');
  place(fOther, x + 16, z - 10, 0, 0);
  g.add(fIN, fOther);
  g.userData = { flags: [fIN.userData.cloth, fOther.userData.cloth] };

  // Small guard hut.
  const hut = buildBuilding(4.5, 3.2, 4.5, 'Gate_GuardHut', { windows: 1 });
  place(hut, x - 13, z - 8, 0, 20 * DEG);
  g.add(hut);

  return g;
}

export function buildWatchtower() {
  const g = new THREE.Group();
  g.name = 'ZONE_Watchtower';
  const { x, z } = A.watchtower;
  const H = 12;
  const legs = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, H, 8), mat('MAT_PowderCoat_Olive'));
    leg.position.set(sx * 2.4, H / 2, sz * 2.4);
    leg.rotation.set(sz * 0.05, 0, -sx * 0.05);
    leg.castShadow = true;
    leg.name = 'Tower_Leg';
    legs.add(leg);
  }
  for (let level = 1; level <= 3; level++) {
    const brace = new THREE.Mesh(new THREE.TorusGeometry(3.3, 0.08, 6, 4), mat('MAT_PowderCoat_Olive'));
    brace.rotation.x = Math.PI / 2;
    brace.rotation.z = Math.PI / 4;
    brace.position.y = level * (H / 4);
    brace.name = 'Tower_Brace';
    legs.add(brace);
  }
  const deck = box(7, 0.35, 7, mat('MAT_PowderCoat_Olive'), 'Tower_Deck');
  deck.position.y = H;
  const cabin = box(5.2, 2.6, 5.2, mat('MAT_BuildingWall'), 'Tower_Cabin');
  cabin.position.y = H + 1.5;
  const glazing = box(5.4, 1.2, 5.4, mat('MAT_Glass_Display'), 'Tower_Glazing');
  glazing.position.y = H + 2.0;
  const roof = box(7.4, 0.4, 7.4, mat('MAT_RoofMetal'), 'Tower_Roof');
  roof.position.y = H + 3.0;
  const searchlight = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 0.7, 14), mat('MAT_Aluminium_Brushed'));
  searchlight.rotation.z = Math.PI / 2;
  searchlight.position.set(2.8, H + 3.4, 0);
  searchlight.name = 'Tower_Searchlight';
  g.add(legs, deck, cabin, glazing, roof, searchlight);
  place(g, x, z, 0, 28 * DEG);
  g.userData = { searchlight };
  return g;
}

// ---------------------------------------------------------------------------
// Roads and vehicles
// ---------------------------------------------------------------------------
/** Ground-hugging ribbon (roads, patrol tracks) that follows the terrain. */
export function ribbonMesh(routeXZ, half, material, lift = 0.14, samples = 260) {
  const curve = new THREE.CatmullRomCurve3(routeXZ.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const nx = -tan.z, nz = tan.x;
    const ax = p.x + nx * half, az = p.z + nz * half;
    const bx = p.x - nx * half, bz = p.z - nz * half;
    positions.push(ax, terrainHeight(ax, az) + lift, az, bx, terrainHeight(bx, bz) + lift, bz);
    uvs.push(0, t * 30, 1, t * 30);
    if (i < samples) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.userData.curve = curve;
  return mesh;
}

export function buildRoads() {
  const g = new THREE.Group();
  g.name = 'ENV_Roads';

  // Service road: airbase → gate → tracking station.
  const road = ribbonMesh([
    [-190, 178], [-118, 196], [-36, 210], [46, 222], [88, 226],
    [140, 196], [186, 150], [218, 92], [236, 26], [232, -16],
  ], 3.4, new THREE.MeshStandardMaterial({ color: '#3a3b38', roughness: 0.95 }));
  road.name = 'Road_Surface';
  g.add(road);

  // Graded patrol track running just inside the perimeter — this is what makes
  // the fence line legible from the overview camera.
  const inside = FENCE_PATH.map(([x, z]) => [x - 7, z - 5]);
  const track = ribbonMesh(inside, 2.6,
    new THREE.MeshStandardMaterial({ color: '#8b8271', roughness: 0.98 }), 0.12, 300);
  track.name = 'PatrolTrack_Surface';
  g.add(track);

  g.userData = { curve: road.userData.curve };
  return g;
}

export function makeVehicle(kind = 'truck') {
  const g = new THREE.Group();
  g.name = kind === 'truck' ? 'Vehicle_Truck' : 'Vehicle_UtilityLight';
  const olive = mat('MAT_PowderCoat_Olive');
  const L = kind === 'truck' ? 7.2 : 4.6;
  const body = box(2.5, 1.5, L, olive, 'Vehicle_Body');
  body.position.y = 1.5;
  const cab = box(2.4, 1.4, kind === 'truck' ? 2.2 : 2.0, olive, 'Vehicle_Cab');
  cab.position.set(0, 2.6, L / 2 - 1.4);
  const glass = box(2.2, 0.7, 0.12, mat('MAT_Glass_Display'), 'Vehicle_Windscreen');
  glass.position.set(0, 2.9, L / 2 - 0.35);
  g.add(body, cab, glass);
  if (kind === 'truck') {
    const canopy = box(2.5, 1.6, 4.0, mat('MAT_FabricTan'), 'Vehicle_Canopy');
    canopy.position.set(0, 3.0, -1.2);
    g.add(canopy);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.45, 14);
  const axles = kind === 'truck' ? [-2.2, 0.4, 2.4] : [-1.4, 1.5];
  for (const az of axles) {
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, mat('MAT_Rubber_Black'));
      w.rotation.z = Math.PI / 2;
      w.position.set(s * 1.3, 0.62, az);
      w.name = 'Vehicle_Wheel';
      g.add(w);
    }
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

export function buildParkedVehicles() {
  const g = new THREE.Group();
  g.name = 'ENV_Vehicles';
  const rng = makeRng(555);
  const spots = [
    [A.command.x - 6, A.command.z + 20, 'truck', 10],
    [A.command.x + 10, A.command.z + 22, 'light', -20],
    [A.gate.x - 18, A.gate.z + 9, 'light', 80],
    [A.runway.x + 42, A.runway.z - 40, 'truck', -8],
    [A.runway.x - 28, A.runway.z - 42, 'light', 4],
    [124, 190, 'truck', -46],
  ];
  for (const [x, z, kind, rot] of spots) {
    const v = makeVehicle(kind);
    place(v, x, z, 0, rot * DEG + (rng() - 0.5) * 0.1);
    g.add(v);
  }
  return g;
}

/** Secondary site fabric: equipment shelters, stores, lighting, masts.
 *  These carry no capability claim — they give the installation the density a
 *  real site has, so the instrumented zones read as part of a working base. */
export function buildSupportStructures() {
  const g = new THREE.Group();
  g.name = 'ENV_SupportStructures';

  // Equipment shelters serving the instrument field.
  for (const [sx, sz, rot] of [[-70, 128, 12], [-16, 132, -8], [34, 88, 26]]) {
    const shed = buildBuilding(7, 3.2, 5, 'Equipment_Shelter', { windows: 1 });
    place(shed, sx, sz, 0, rot * DEG);
    g.add(shed);
  }

  // Stores yard: shipping containers beside the hangar line.
  const containerMats = ['MAT_PowderCoat_Olive', 'MAT_PowderCoat_Grey', 'MAT_SandbagTan'];
  for (let i = 0; i < 6; i++) {
    const c = box(2.6, 2.6, 6.2, mat(containerMats[i % 3]), 'Stores_Container');
    const cx = A.hangars.x + 86 + (i % 2) * 3.2;
    const cz = A.hangars.z - 6 + Math.floor(i / 2) * 7.4;
    place(c, cx, cz, 1.3, (i % 2 ? 4 : -3) * DEG);
    g.add(c);
  }

  // Road lighting — instanced poles along the service road.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 8);
  const route = [
    [-170, 172], [-110, 192], [-50, 206], [10, 216], [70, 224],
    [124, 206], [166, 172], [204, 126], [228, 70], [236, 18],
  ];
  const poles = new THREE.InstancedMesh(poleGeo, mat('MAT_PowderCoat_Grey'), route.length);
  poles.name = 'Road_LightPoles';
  poles.castShadow = true;
  const m4 = new THREE.Matrix4();
  route.forEach(([px, pz], i) => {
    m4.makeTranslation(px, terrainHeight(px, pz) + 3.5, pz);
    poles.setMatrixAt(i, m4);
  });
  g.add(poles);
  const headGeo = new THREE.BoxGeometry(0.9, 0.18, 0.4);
  const heads = new THREE.InstancedMesh(headGeo, matClone('MAT_LED_Amber'), route.length);
  heads.name = 'Road_LightHeads';
  heads.userData.nightOnly = true;
  route.forEach(([px, pz], i) => {
    m4.makeTranslation(px + 0.4, terrainHeight(px, pz) + 7, pz);
    heads.setMatrixAt(i, m4);
  });
  g.add(heads);
  g.userData.lampMaterial = heads.material;

  // Meteorological mast beside the instrument field (environmental context).
  const mast = new THREE.Group();
  mast.name = 'Met_Mast';
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 12, 10), mat('MAT_StainlessSteel'));
  pole.position.y = 6;
  pole.castShadow = true;
  mast.add(pole);
  for (const yy of [6.4, 9.2, 11.6]) {
    const arm = box(2.4, 0.1, 0.1, mat('MAT_StainlessSteel'), 'Met_Arm');
    arm.position.set(1.1, yy, 0);
    mast.add(arm);
  }
  const cups = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat('MAT_Polycarbonate_White'));
  cups.position.set(2.2, 11.8, 0);
  mast.add(cups);
  place(mast, 26, 124, 0, -20 * DEG);
  g.add(mast);

  return g;
}

/** Perimeter sensor posts sited along the fence. */
export function buildSensorPosts(makePost) {
  const g = new THREE.Group();
  g.name = 'ZONE_BorderSensors';
  SENSOR_POSTS.forEach((spec, i) => {
    const post = makePost();
    const p = fencePoint(spec.t);
    post.position.copy(p);
    post.position.x -= 6;
    post.position.y = terrainHeight(post.position.x, p.z);
    post.rotation.y = -0.6 + i * 0.22;
    post.name = `SensorPost_${spec.id}`;
    post.userData = { ...post.userData, sensorId: spec.id, system: 'border' };
    g.add(post);
  });
  return g;
}
