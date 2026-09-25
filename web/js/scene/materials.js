// Shared PBR material library. Names mirror the Blender master scene so the two
// deliverables stay consistent (MAT_Aluminium_Brushed, MAT_LED_Red, ...).

import * as THREE from 'three';

const cache = new Map();

function reg(name, mat) {
  mat.name = name;
  cache.set(name, mat);
  return mat;
}

function std(name, opts) {
  return reg(name, new THREE.MeshStandardMaterial(opts));
}

export function initMaterials() {
  if (cache.size) return;

  std('MAT_Aluminium_Brushed', { color: '#9aa4ad', metalness: 0.85, roughness: 0.29 });
  std('MAT_Aluminium_Black', { color: '#1b1f24', metalness: 0.72, roughness: 0.36 });
  std('MAT_StainlessSteel', { color: '#b3bcc2', metalness: 0.92, roughness: 0.22 });
  std('MAT_PowderCoat_Grey', { color: '#4a5257', metalness: 0.2, roughness: 0.62 });
  std('MAT_PowderCoat_Olive', { color: '#41462f', metalness: 0.15, roughness: 0.7 });
  std('MAT_Polycarbonate_White', { color: '#e6e9e6', metalness: 0, roughness: 0.38 });
  std('MAT_Rubber_Black', { color: '#141618', metalness: 0, roughness: 0.85 });
  std('MAT_Glass_Display', { color: '#0a1016', metalness: 0.2, roughness: 0.14 });
  std('MAT_Cable', { color: '#15181a', metalness: 0, roughness: 0.82 });
  std('MAT_Concrete', { color: '#8c8b84', metalness: 0, roughness: 0.93 });
  std('MAT_Asphalt', { color: '#2e3134', metalness: 0, roughness: 0.94 });
  std('MAT_RoadPaint', { color: '#d9dcd8', metalness: 0, roughness: 0.8 });
  std('MAT_ArmyFabric', { color: '#3f4529', metalness: 0, roughness: 0.92 });
  std('MAT_FabricTan', { color: '#6c6146', metalness: 0, roughness: 0.93 });
  std('MAT_Skin', { color: '#8a5c3d', metalness: 0, roughness: 0.68 });
  std('MAT_Snow', { color: '#eef4fa', metalness: 0, roughness: 0.82 });
  std('MAT_SolarPanel', { color: '#101a35', metalness: 0.55, roughness: 0.26 });
  std('MAT_BuildingWall', { color: '#6d6a5c', metalness: 0, roughness: 0.88 });
  std('MAT_RoofMetal', { color: '#474c46', metalness: 0.42, roughness: 0.6 });
  std('MAT_SandbagTan', { color: '#7a6d52', metalness: 0, roughness: 0.95 });
  std('MAT_Flag_IN_Base', { color: '#ffffff', metalness: 0, roughness: 0.8, side: THREE.DoubleSide });

  // Emissive indicators. Base colour kept dark so they read as lit elements.
  const led = (name, color, strength = 3.2) => std(name, {
    color: '#0b0d0f', emissive: color, emissiveIntensity: strength, roughness: 0.4, metalness: 0,
  });
  led('MAT_LED_Green', '#25d366');
  led('MAT_LED_Amber', '#ff9d2e');
  led('MAT_LED_Red', '#ff3b30');
  led('MAT_LED_Blue', '#3fa9f5');
  led('MAT_LED_Off', '#1a1d20', 0.05);

  std('MAT_Screen', { color: '#05080d', emissive: '#0a1622', emissiveIntensity: 1, roughness: 0.28 });
  std('MAT_Gold', { color: '#d9a233', metalness: 0.9, roughness: 0.28 });
}

export function mat(name) {
  initMaterials();
  const m = cache.get(name);
  if (!m) throw new Error(`Unknown material: ${name}`);
  return m;
}

/** Independent copy, for parts whose emissive state is animated per-object. */
export function matClone(name) {
  return mat(name).clone();
}

/** Emissive material driven by a canvas (in-scene screens). */
export function screenMaterial(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.MeshStandardMaterial({
    // Matte anti-glare finish: a glossy screen catches the camera fill light
    // as a white hotspot in close-ups.
    map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 1.25,
    roughness: 0.7, metalness: 0, color: '#0a0d12',
  });
  m.userData.texture = tex;
  return m;
}

export function setEmissive(object, colorHex, intensity) {
  object.traverse((o) => {
    if (o.isMesh && o.material && o.material.emissive) {
      o.material.emissive.setHex(colorHex);
      o.material.emissiveIntensity = intensity;
    }
  });
}
