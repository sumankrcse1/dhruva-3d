// Hero hardware. Dimensions follow the manufacturer reference sheets already
// validated in the Blender master (QA_report.json):
//   EFM-100C sensor  ~170 mm dia x 130 mm, 3/4" NPT mount, inverted installation
//   ANT-50           124 mm dia x 254 mm overall, on the supplied 610 mm mast
//   LRX-1 receiver   160 x 114 x 28 mm
// Anything not established by those references is built as a clearly named
// placeholder rather than invented detail.

import * as THREE from 'three';
import { mat, matClone, screenMaterial } from './materials.js';

const DEG = Math.PI / 180;

/** Box with bevelled manufactured edges, centred on its own origin. */
export function roundedBox(w, h, d, r = Math.min(w, h, d) * 0.08, material) {
  const rr = Math.min(r, w / 2.2, h / 2.2, d / 2.2);
  const shape = new THREE.Shape();
  const x = -w / 2 + rr, y = -h / 2 + rr, W = w - rr * 2, H = h - rr * 2;
  shape.moveTo(x, -h / 2);
  shape.lineTo(x + W, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, y);
  shape.lineTo(w / 2, y + H);
  shape.quadraticCurveTo(w / 2, h / 2, x + W, h / 2);
  shape.lineTo(x, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, y + H);
  shape.lineTo(-w / 2, y);
  shape.quadraticCurveTo(-w / 2, -h / 2, x, -h / 2);
  const bevel = Math.min(rr * 0.5, d * 0.2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel,
    bevelSize: bevel, bevelSegments: 2, curveSegments: 8,
  });
  geo.translate(0, 0, -(d - bevel * 2) / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(r1, r2, h, material, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), material);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function part(group, mesh, name, pos, rot) {
  mesh.name = name;
  if (pos) mesh.position.set(pos[0], pos[1], pos[2]);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  group.add(mesh);
  return mesh;
}

/** Ring of hex-head fasteners. */
function bolts(group, count, radius, y, size = 0.004, name = 'Fastener') {
  const geo = new THREE.CylinderGeometry(size, size, size * 1.3, 6);
  const im = new THREE.InstancedMesh(geo, mat('MAT_StainlessSteel'), count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    m.makeTranslation(Math.cos(a) * radius, y, Math.sin(a) * radius);
    im.setMatrixAt(i, m);
  }
  im.name = name;
  im.castShadow = true;
  group.add(im);
  return im;
}

/** Cable run as a tube through the supplied points (adds a drip loop). */
function cable(points, radius = 0.006) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, 7, false),
    mat('MAT_Cable'),
  );
  mesh.castShadow = true;
  mesh.name = 'Cable';
  return mesh;
}

// ---------------------------------------------------------------------------
// EFM-100C electric field mill, inverted mast installation
// ---------------------------------------------------------------------------
export function makeEFM() {
  const g = new THREE.Group();
  g.name = 'EFM100_Installation';

  const alu = mat('MAT_Aluminium_Brushed');
  const steel = mat('MAT_StainlessSteel');

  // --- Tripod base + mast (installation hardware) ---
  const base = part(g, cyl(0.19, 0.22, 0.05, mat('MAT_Concrete'), 24), 'EFM_BasePlate', [0, 0.025, 0]);
  base.receiveShadow = true;
  for (let i = 0; i < 3; i++) {
    const a = i * 120 * DEG;
    const leg = cyl(0.016, 0.016, 1.34, steel, 12);
    leg.position.set(Math.cos(a) * 0.3, 0.68, Math.sin(a) * 0.3);
    leg.rotation.set(Math.cos(a + Math.PI / 2) * 0.24, 0, -Math.sin(a + Math.PI / 2) * 0.24);
    leg.lookAt(0, 1.4, 0);
    leg.position.set(Math.cos(a) * 0.17, 0.7, Math.sin(a) * 0.17);
    leg.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22);
    part(g, leg, `EFM_TripodLeg_${i + 1}`);
    const foot = cyl(0.05, 0.055, 0.03, mat('MAT_Concrete'), 12);
    part(g, foot, `EFM_TripodFoot_${i + 1}`, [Math.cos(a) * 0.32, 0.015, Math.sin(a) * 0.32]);
  }
  part(g, cyl(0.027, 0.027, 2.35, steel, 24), 'EFM_Mast', [0, 1.2, 0]);

  // --- Curved support arm for the inverted mounting (per Boltek EFM-INV) ---
  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 2.3, 0), new THREE.Vector3(0, 2.52, 0.06),
    new THREE.Vector3(0, 2.6, 0.2), new THREE.Vector3(0, 2.56, 0.34),
  ]);
  const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 40, 0.019, 10, false), steel);
  arm.castShadow = true;
  part(g, arm, 'EFM_InvertedSupportArm');

  // --- 3/4" NPT mounting interface ---
  part(g, cyl(0.022, 0.022, 0.05, steel, 20), 'EFM_NPT_Mount_0.75in', [0, 2.5, 0.34]);
  part(g, cyl(0.03, 0.03, 0.012, steel, 6), 'EFM_MountNut', [0, 2.47, 0.34]);

  // --- Sensor body: 170 mm diameter x 130 mm high, sensing face downward ---
  const body = new THREE.Group();
  body.name = 'EFM_SensorAssembly';
  body.position.set(0, 2.4, 0.34);
  part(body, cyl(0.085, 0.085, 0.104, alu, 48), 'EFM_Body', [0, -0.052, 0]);
  part(body, cyl(0.0835, 0.085, 0.006, alu, 48), 'EFM_UpperChamfer', [0, 0.003, 0]);
  // Seam between the machined halves.
  part(body, cyl(0.0857, 0.0857, 0.004, mat('MAT_Aluminium_Black'), 48), 'EFM_HousingSeam', [0, -0.052, 0]);
  // Lower sensing assembly (shutter housing). Internal geometry is deliberately
  // not modelled — the supplied references do not establish it.
  part(body, cyl(0.085, 0.074, 0.02, alu, 48), 'EFM_LowerHousing', [0, -0.114, 0]);
  const face = part(body, cyl(0.072, 0.072, 0.006, mat('MAT_Aluminium_Black'), 48),
    'EFM_SensingFace_PLACEHOLDER', [0, -0.127, 0]);
  face.userData.note = 'Sensing-face detail withheld: not established by supplied references.';
  bolts(body, 6, 0.072, -0.001, 0.0035, 'EFM_LidFastener');
  // Weatherproof cable gland + label decal plate.
  part(body, cyl(0.009, 0.009, 0.026, steel, 14), 'EFM_CableGland', [0.06, -0.106, 0], [Math.PI / 2 * 0.55, 0, 0]);
  const label = part(body, roundedBox(0.062, 0.03, 0.001, 0.004, mat('MAT_Polycarbonate_White')),
    'EFM_LabelDecal', [0, -0.055, 0.0855], [0, 0, 0]);
  label.userData.noPick = true;
  g.add(body);

  // --- Junction box, cable with drip loop, ground bond ---
  const jb = part(g, roundedBox(0.16, 0.2, 0.09, 0.012, mat('MAT_PowderCoat_Grey')),
    'EFM_JunctionBox', [0.19, 1.0, 0], [0, Math.PI / 2, 0]);
  jb.castShadow = true;
  part(g, cyl(0.012, 0.012, 0.02, steel, 12), 'EFM_JB_Gland', [0.19, 0.89, 0], [Math.PI / 2, 0, 0]);
  g.add(cable([
    [0.06, 2.29, 0.34], [0.09, 2.15, 0.30], [0.05, 1.95, 0.16],
    [0.03, 1.7, 0.03], [0.04, 1.35, 0.0], [0.11, 1.18, 0.0],
    [0.2, 1.24, 0.0], [0.21, 1.1, 0.0],
  ]));
  g.add(cable([[0.19, 0.89, 0], [0.2, 0.5, 0.02], [0.16, 0.2, 0.06], [0.05, 0.06, 0.12], [-0.1, 0.03, 0.2]]));
  // Ground conductor to rod.
  const gnd = cable([[0.0, 0.05, 0.0], [0.12, 0.04, -0.16], [0.3, 0.02, -0.3]], 0.004);
  gnd.material = mat('MAT_LED_Off');
  gnd.name = 'EFM_GroundBond';
  g.add(gnd);
  part(g, cyl(0.008, 0.008, 0.16, mat('MAT_StainlessSteel'), 10), 'EFM_GroundRod', [0.3, -0.05, -0.3]);

  g.userData = {
    hero: true,
    exhibitionScale: 22,
    system: 'efm',
    trueSize: 'Sensor 170 mm dia x 130 mm on 2.35 m mast',
  };
  return g;
}

// ---------------------------------------------------------------------------
// ANT-50 antenna + LRX-1 receiver (lightning detection node)
// ---------------------------------------------------------------------------
export function makeANT50() {
  const g = new THREE.Group();
  g.name = 'ANT50_Assembly';
  const white = mat('MAT_Polycarbonate_White');
  const steel = mat('MAT_StainlessSteel');

  // Supplied mast, 610 mm, nominal 3/4" pipe.
  part(g, cyl(0.0134, 0.0134, 0.61, steel, 20), 'ANT50_Mast_610mm', [0, 0.305, 0]);
  part(g, cyl(0.075, 0.09, 0.03, mat('MAT_PowderCoat_Grey'), 20), 'ANT50_MastFlange', [0, 0.015, 0]);
  // Mounting clamps.
  for (const y of [0.14, 0.26]) {
    part(g, new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 8, 18), mat('MAT_PowderCoat_Grey')),
      'ANT50_MountClamp', [0, y, 0], [Math.PI / 2, 0, 0]);
  }
  // Radome: 124 mm diameter, 192 mm cylinder + 62 mm dome = 254 mm overall.
  const bodyY = 0.61;
  part(g, cyl(0.062, 0.062, 0.192, white, 40), 'ANT50_Radome', [0, bodyY + 0.096, 0]);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.062, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), white);
  dome.scale.y = 1.0;
  dome.castShadow = true;
  part(g, dome, 'ANT50_Dome', [0, bodyY + 0.192, 0]);
  part(g, cyl(0.066, 0.066, 0.012, white, 40), 'ANT50_BaseCollar', [0, bodyY + 0.006, 0]);
  bolts(g, 4, 0.05, bodyY + 0.014, 0.0035, 'ANT50_CollarFastener');
  part(g, cyl(0.011, 0.011, 0.022, steel, 14), 'ANT50_CableEntry', [0, bodyY - 0.008, 0]);
  g.add(cable([
    [0, bodyY - 0.02, 0], [0.02, bodyY - 0.08, 0.01], [0.022, 0.34, 0.012],
    [0.018, 0.1, 0.01], [0.0, 0.02, 0.0], [-0.08, 0.012, -0.04],
  ], 0.005));

  g.userData = { hero: true, exhibitionScale: 22, system: 'lds', trueSize: '124 mm dia x 254 mm on 610 mm mast' };
  return g;
}

export function makeLRX1() {
  const g = new THREE.Group();
  g.name = 'LRX1_Receiver';
  // 160 x 114 x 28 mm black aluminium enclosure.
  const body = part(g, roundedBox(0.16, 0.028, 0.114, 0.004, mat('MAT_Aluminium_Black')),
    'LRX1_Enclosure', [0, 0.014, 0], [Math.PI / 2, 0, 0]);
  body.castShadow = true;

  // Six labelled front indicators (per the LRX-1 front panel reference).
  const ledNames = ['LRX1_LED_Power', 'LRX1_LED_Strike', 'LRX1_LED_Noise',
    'LRX1_LED_GPS', 'LRX1_LED_Net', 'LRX1_LED_Status'];
  const ledMats = ['MAT_LED_Green', 'MAT_LED_Amber', 'MAT_LED_Off',
    'MAT_LED_Green', 'MAT_LED_Blue', 'MAT_LED_Green'];
  g.userData.leds = [];
  ledNames.forEach((n, i) => {
    const m = matClone(ledMats[i]);
    const led = part(g, cyl(0.0035, 0.0035, 0.002, m, 12), n,
      [-0.055 + i * 0.022, 0.0285, 0.0], [0, 0, 0]);
    g.userData.leds.push(led);
  });
  // Front connectors — arrangement only, per the specification sheet.
  part(g, cyl(0.0065, 0.0065, 0.008, mat('MAT_StainlessSteel'), 14), 'LRX1_AntennaConnector',
    [0.062, 0.014, 0.058], [Math.PI / 2, 0, 0]);
  part(g, roundedBox(0.016, 0.013, 0.008, 0.002, mat('MAT_StainlessSteel')), 'LRX1_EthernetPort',
    [0.03, 0.014, 0.058]);
  part(g, cyl(0.0035, 0.0035, 0.008, mat('MAT_StainlessSteel'), 12), 'LRX1_DC_Input',
    [0.0, 0.014, 0.058], [Math.PI / 2, 0, 0]);

  g.userData = { ...g.userData, hero: true, exhibitionScale: 22, system: 'lds', trueSize: '160 x 114 x 28 mm' };
  return g;
}

/** Sheltered cabinet housing the indoor-rated LRX-1 at a field node. */
export function makeNodeCabinet() {
  const g = new THREE.Group();
  g.name = 'LDN_NodeCabinet';
  const cab = part(g, roundedBox(0.5, 0.62, 0.26, 0.02, mat('MAT_PowderCoat_Grey')),
    'Cabinet_Enclosure', [0, 0.95, 0]);
  cab.castShadow = true;
  part(g, roundedBox(0.44, 0.02, 0.24, 0.006, mat('MAT_PowderCoat_Grey')), 'Cabinet_Shelf', [0, 0.95, 0.01]);
  part(g, cyl(0.03, 0.03, 0.64, mat('MAT_StainlessSteel'), 12), 'Cabinet_Post_L', [-0.2, 0.32, 0]);
  part(g, cyl(0.03, 0.03, 0.64, mat('MAT_StainlessSteel'), 12), 'Cabinet_Post_R', [0.2, 0.32, 0]);
  part(g, roundedBox(0.56, 0.03, 0.32, 0.01, mat('MAT_RoofMetal')), 'Cabinet_SunShield', [0, 1.3, 0]);
  const lrx = makeLRX1();
  lrx.position.set(0, 0.96, 0.02);
  lrx.scale.setScalar(1);
  g.add(lrx);
  g.userData = { hero: true, exhibitionScale: 12, system: 'lds' };
  return g;
}

// ---------------------------------------------------------------------------
// Early-warning beacon + sounder
// ---------------------------------------------------------------------------
export function makeWarningStack() {
  const g = new THREE.Group();
  g.name = 'WarningStack';
  const grey = mat('MAT_PowderCoat_Grey');

  part(g, cyl(0.22, 0.26, 0.12, mat('MAT_Concrete'), 18), 'Warn_Plinth', [0, 0.06, 0]);
  part(g, cyl(0.05, 0.05, 3.0, grey, 18), 'Warn_Pole', [0, 1.5, 0]);

  // Industrial LED beacon.
  const beaconMat = matClone('MAT_LED_Amber');
  beaconMat.transparent = true;
  beaconMat.opacity = 0.92;
  const beacon = part(g, cyl(0.085, 0.085, 0.16, beaconMat, 24), 'Warn_LEDBeacon', [0, 3.08, 0]);
  part(g, cyl(0.09, 0.09, 0.03, grey, 24), 'Warn_BeaconCap', [0, 3.18, 0]);
  part(g, cyl(0.09, 0.09, 0.035, grey, 24), 'Warn_BeaconBase', [0, 2.98, 0]);
  const light = new THREE.PointLight(0xff9d2e, 0, 40, 2);
  light.position.set(0, 3.08, 0);
  g.add(light);

  // Sounder / siren horn.
  const horn = part(g, cyl(0.055, 0.13, 0.2, grey, 20), 'Warn_Sounder', [0, 2.64, 0.12], [Math.PI / 2, 0, 0]);
  horn.castShadow = true;

  // Local status display + control electronics enclosure.
  const panel = part(g, roundedBox(0.34, 0.24, 0.02, 0.008, mat('MAT_Screen')), 'Warn_LocalDisplay',
    [0, 1.72, 0.1]);
  const cab = part(g, roundedBox(0.36, 0.5, 0.2, 0.014, grey), 'Warn_ControlEnclosure', [0, 1.3, -0.02]);
  cab.castShadow = true;
  const state = part(g, cyl(0.02, 0.02, 0.01, matClone('MAT_LED_Green'), 12), 'Warn_StateLamp',
    [0.13, 1.52, 0.1], [Math.PI / 2, 0, 0]);
  g.add(cable([[0, 1.05, -0.02], [0.02, 0.6, -0.06], [0, 0.2, -0.1], [-0.18, 0.06, -0.2]], 0.008));

  g.userData = {
    hero: true, exhibitionScale: 6, system: 'warning',
    beacon, beaconMat, light, stateLamp: state, panel,
    trueSize: 'Warning hardware is a labelled placeholder — final alert hardware not supplied',
  };
  return g;
}

// ---------------------------------------------------------------------------
// Border sensor post (RX/TX) — perimeter surveillance & object detection
// ---------------------------------------------------------------------------
export function makeSensorPost() {
  const g = new THREE.Group();
  g.name = 'BorderSensorPost';
  const grey = mat('MAT_PowderCoat_Grey');
  const black = mat('MAT_Aluminium_Black');

  part(g, cyl(0.26, 0.3, 0.2, mat('MAT_Concrete'), 16), 'Post_Foundation', [0, 0.1, 0]);
  part(g, cyl(0.06, 0.07, 4.6, grey, 16), 'Post_Mast', [0, 2.3, 0]);

  // Solar panel + battery box (power).
  const solar = part(g, roundedBox(0.72, 0.5, 0.03, 0.008, mat('MAT_SolarPanel')), 'Post_SolarPanel',
    [0, 4.3, -0.28], [-52 * DEG, 0, 0]);
  solar.castShadow = true;
  part(g, roundedBox(0.3, 0.42, 0.22, 0.012, grey), 'Post_BatteryBox', [0.0, 1.3, -0.18]);

  // Sensor head: EO camera + RX/TX panel antennas.
  const head = part(g, roundedBox(0.3, 0.18, 0.22, 0.012, black), 'Post_CameraHead', [0, 3.86, 0.16]);
  part(g, cyl(0.055, 0.055, 0.06, black, 20), 'Post_CameraLens', [0, 3.86, 0.3], [Math.PI / 2, 0, 0]);
  part(g, cyl(0.05, 0.05, 0.008, matClone('MAT_LED_Blue'), 20), 'Post_StatusLED', [0, 3.86, 0.335], [Math.PI / 2, 0, 0]);
  const rx = part(g, roundedBox(0.14, 0.44, 0.06, 0.01, mat('MAT_Polycarbonate_White')), 'Post_Antenna_RX',
    [0.17, 3.3, 0], [0, 25 * DEG, 0]);
  const tx = part(g, roundedBox(0.14, 0.44, 0.06, 0.01, mat('MAT_Polycarbonate_White')), 'Post_Antenna_TX',
    [-0.17, 3.3, 0], [0, -25 * DEG, 0]);
  rx.castShadow = tx.castShadow = true;
  part(g, roundedBox(0.26, 0.3, 0.16, 0.01, grey), 'Post_EdgeEnclosure', [0, 2.4, -0.16]);
  g.add(cable([[0, 3.8, 0.1], [0.06, 3.2, -0.02], [0.05, 2.6, -0.1], [0, 1.5, -0.12], [0, 0.3, -0.1]], 0.012));

  g.userData = { hero: true, exhibitionScale: 3.4, system: 'border' };
  return g;
}

// ---------------------------------------------------------------------------
// Soldier wearable + handheld devices
// ---------------------------------------------------------------------------
export function makeHealthWatch(canvas) {
  const g = new THREE.Group();
  g.name = 'HealthWatch';
  // Dimensions are a labelled placeholder: watch drawings were not supplied.
  const caseMesh = part(g, cyl(0.023, 0.023, 0.013, mat('MAT_Aluminium_Black'), 32), 'Watch_Case', [0, 0, 0]);
  caseMesh.rotation.x = Math.PI / 2;
  const bezel = part(g, new THREE.Mesh(new THREE.TorusGeometry(0.0225, 0.0025, 10, 36),
    mat('MAT_StainlessSteel')), 'Watch_Bezel', [0, 0, 0.0068]);
  const screenMat = canvas ? screenMaterial(canvas) : mat('MAT_Screen');
  const face = part(g, new THREE.Mesh(new THREE.CircleGeometry(0.0205, 36), screenMat), 'Watch_Display',
    [0, 0, 0.0072]);
  // Twelve o'clock points along the forearm, so the face reads upright to the
  // wearer (and to the presentation camera) without twisting the strap.
  face.rotation.z = -Math.PI / 2;
  part(g, cyl(0.0035, 0.0035, 0.006, mat('MAT_StainlessSteel'), 12), 'Watch_Button',
    [0.0245, 0.004, 0], [0, 0, Math.PI / 2]);
  // Underside optical sensor area.
  part(g, cyl(0.009, 0.009, 0.002, mat('MAT_LED_Green'), 16), 'Watch_SensorArray', [0, 0, -0.0072]);
  const strapMat = mat('MAT_Rubber_Black');
  part(g, roundedBox(0.024, 0.05, 0.005, 0.002, strapMat), 'Watch_Strap_Upper', [0, 0.036, -0.002]);
  part(g, roundedBox(0.024, 0.05, 0.005, 0.002, strapMat), 'Watch_Strap_Lower', [0, -0.036, -0.002]);

  g.userData = {
    hero: true, exhibitionScale: 26, system: 'wearable', display: screenMat,
    trueSize: 'Watch geometry is a placeholder — product drawings not supplied',
  };
  return g;
}

export function makeAndroidDevice(canvas, w = 0.17, h = 0.26) {
  const g = new THREE.Group();
  g.name = 'AndroidDevice';
  const body = part(g, roundedBox(w, h, 0.011, 0.008, mat('MAT_Aluminium_Black')), 'Device_Body');
  body.castShadow = true;
  const screenMat = canvas ? screenMaterial(canvas) : mat('MAT_Screen');
  part(g, new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, h * 0.9), screenMat), 'Device_Screen', [0, 0, 0.0062]);
  part(g, roundedBox(w * 0.96, h * 0.99, 0.004, 0.006, mat('MAT_Rubber_Black')), 'Device_RuggedCase', [0, 0, -0.005]);
  g.userData = { hero: true, exhibitionScale: 9, display: screenMat };
  return g;
}

/** Wall display or console monitor driven by a canvas dashboard. */
export function makeDisplayPanel(canvas, w = 2.4, h = 1.35) {
  const g = new THREE.Group();
  g.name = 'DisplayPanel';
  const frame = part(g, roundedBox(w + 0.06, h + 0.06, 0.06, 0.012, mat('MAT_Aluminium_Black')), 'Display_Frame');
  frame.castShadow = true;
  const screenMat = canvas ? screenMaterial(canvas) : mat('MAT_Screen');
  part(g, new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMat), 'Display_Screen', [0, 0, 0.032]);
  g.userData = { display: screenMat };
  return g;
}

export function makeRuggedLaptop(canvas) {
  const g = new THREE.Group();
  g.name = 'RuggedWorkstation';
  const base = part(g, roundedBox(0.4, 0.28, 0.03, 0.008, mat('MAT_PowderCoat_Olive')), 'Laptop_Base',
    [0, 0.015, 0], [-Math.PI / 2, 0, 0]);
  base.castShadow = true;
  const lid = new THREE.Group();
  lid.position.set(0, 0.03, -0.14);
  lid.rotation.x = -20 * DEG;
  const lidBody = roundedBox(0.4, 0.26, 0.016, 0.006, mat('MAT_PowderCoat_Olive'));
  lidBody.position.set(0, 0.13, 0);
  lidBody.name = 'Laptop_Lid';
  lid.add(lidBody);
  const screenMat = canvas ? screenMaterial(canvas) : mat('MAT_Screen');
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.22), screenMat);
  scr.position.set(0, 0.13, 0.009);
  scr.name = 'Laptop_Screen';
  lid.add(scr);
  g.add(lid);
  g.userData = { display: screenMat };
  return g;
}

/** Equipment/server rack for the processing node. */
export function makeServerRack() {
  const g = new THREE.Group();
  g.name = 'ProcessingRack';
  const shell = part(g, roundedBox(0.7, 1.9, 0.9, 0.02, mat('MAT_PowderCoat_Grey')), 'Rack_Enclosure', [0, 0.95, 0]);
  shell.castShadow = true;
  for (let i = 0; i < 7; i++) {
    part(g, roundedBox(0.62, 0.11, 0.02, 0.004, mat('MAT_Aluminium_Black')), `Rack_Unit_${i + 1}`,
      [0, 0.45 + i * 0.18, 0.452]);
    const led = part(g, cyl(0.006, 0.006, 0.004, matClone(i % 3 === 0 ? 'MAT_LED_Amber' : 'MAT_LED_Green'), 8),
      `Rack_LED_${i + 1}`, [0.26, 0.45 + i * 0.18, 0.462], [Math.PI / 2, 0, 0]);
    led.userData.blink = 0.4 + i * 0.13;
  }
  g.userData = { hero: true, exhibitionScale: 5, system: 'command' };
  return g;
}

/** Parabolic ground-station dish (drone tracking / satellite link). */
export function makeDish(radius = 1.6) {
  const g = new THREE.Group();
  g.name = 'GroundStationDish';
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.32),
    new THREE.MeshStandardMaterial({ color: '#dfe3e6', metalness: 0.3, roughness: 0.45, side: THREE.DoubleSide }),
  );
  dish.rotation.x = Math.PI;
  dish.castShadow = true;
  dish.name = 'Dish_Reflector';
  const holder = new THREE.Group();
  holder.name = 'Dish_Head';
  holder.add(dish);
  const feed = cyl(0.06, 0.06, 0.3, mat('MAT_PowderCoat_Grey'), 12);
  feed.position.set(0, radius * 0.52, 0);
  feed.name = 'Dish_Feed';
  holder.add(feed);
  for (let i = 0; i < 3; i++) {
    const a = i * 120 * DEG;
    const strut = cyl(0.012, 0.012, radius * 0.62, mat('MAT_StainlessSteel'), 8);
    strut.position.set(Math.cos(a) * radius * 0.4, radius * 0.27, Math.sin(a) * radius * 0.4);
    strut.lookAt(0, radius * 0.52, 0);
    strut.rotateX(Math.PI / 2);
    strut.name = `Dish_Strut_${i + 1}`;
    holder.add(strut);
  }
  holder.position.y = radius * 0.9 + 0.8;
  holder.rotation.x = -32 * DEG;
  g.add(holder);
  part(g, cyl(0.14, 0.18, radius * 0.9 + 0.8, mat('MAT_PowderCoat_Grey'), 16), 'Dish_Pedestal',
    [0, (radius * 0.9 + 0.8) / 2, 0]);
  part(g, cyl(0.5, 0.55, 0.16, mat('MAT_Concrete'), 20), 'Dish_Foundation', [0, 0.08, 0]);
  g.userData = { head: holder, hero: true, exhibitionScale: 2.6, system: 'drone' };
  return g;
}
