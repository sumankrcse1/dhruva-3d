// Sky dome, clouds, stars and the lighting rig. A single `setDaylight(k)` call
// blends the whole environment between clear high-altitude day (k = 1) and the
// night / emergency-alert condition (k = 0).

import * as THREE from 'three';
import { makeRng } from './noise.js';

const SKY_VERT = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAG = /* glsl */`
  varying vec3 vWorld;
  uniform vec3 uHorizonDay, uZenithDay, uHorizonNight, uZenithNight, uSunDir, uSunColor;
  uniform float uDay;
  void main() {
    vec3 dir = normalize(vWorld);
    float h = clamp(dir.y * 1.25, -0.2, 1.0);
    vec3 horizon = mix(uHorizonNight, uHorizonDay, uDay);
    vec3 zenith = mix(uZenithNight, uZenithDay, uDay);
    vec3 col = mix(horizon, zenith, pow(max(h, 0.0), 0.62));
    // Warm scatter around the sun, strongest near the horizon.
    float sun = max(dot(dir, normalize(uSunDir)), 0.0);
    col += uSunColor * pow(sun, 8.0) * 0.28 * uDay;
    col += uSunColor * pow(sun, 200.0) * 1.4 * uDay;
    // Haze band just above the ridgeline.
    col = mix(col, horizon * 1.04, smoothstep(0.22, -0.05, dir.y) * 0.85);
    gl_FragColor = vec4(col, 1.0);
  }
`;

function cloudTexture() {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const rng = makeRng(991);
  ctx.clearRect(0, 0, size, size);
  // Build a soft puff from overlapping radial gradients.
  for (let i = 0; i < 26; i++) {
    const r = 18 + rng() * 46;
    const x = size * 0.5 + (rng() - 0.5) * 140;
    const y = size * 0.5 + (rng() - 0.5) * 70;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'ENV_Sky';
    this.daylight = 1;

    this.sunDir = new THREE.Vector3(-0.42, 0.42, 0.66).normalize();

    this.uniforms = {
      uHorizonDay: { value: new THREE.Color('#cfe4f2') },
      uZenithDay: { value: new THREE.Color('#2f7fc4') },
      uHorizonNight: { value: new THREE.Color('#121c2c') },
      uZenithNight: { value: new THREE.Color('#03060e') },
      uSunColor: { value: new THREE.Color('#ffe9c4') },
      uSunDir: { value: this.sunDir.clone() },
      uDay: { value: 1 },
    };

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(4200, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        uniforms: this.uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    dome.name = 'ENV_SkyDome';
    dome.userData.noPick = true;
    this.group.add(dome);

    this.buildClouds();
    this.buildStars();
    this.buildLights();
    scene.add(this.group);

    this.fog = new THREE.FogExp2('#b9ceda', 0.00016);
    scene.fog = this.fog;
    this.dayFog = new THREE.Color('#b9ceda');
    this.nightFog = new THREE.Color('#0b1220');
  }

  buildClouds() {
    const tex = cloudTexture();
    const rng = makeRng(4242);
    this.clouds = new THREE.Group();
    this.clouds.name = 'ENV_Clouds';
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.72, depthWrite: false, fog: false,
    });
    this.cloudMat = mat;
    for (let i = 0; i < 34; i++) {
      const w = 320 + rng() * 620;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.42), mat);
      m.position.set(-2400 + rng() * 4800, 540 + rng() * 520, -2100 + rng() * 2100);
      m.userData.drift = 2 + rng() * 5;
      m.userData.noPick = true;
      m.renderOrder = -1;
      this.clouds.add(m);
    }
    this.group.add(this.clouds);
  }

  buildStars() {
    const rng = makeRng(8181);
    const count = 900;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3(rng() * 2 - 1, rng() * 0.9 + 0.05, rng() * 2 - 1)
        .normalize().multiplyScalar(3600);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: '#cfe0ff', size: 7, sizeAttenuation: true, transparent: true, opacity: 0, fog: false,
    }));
    this.stars.name = 'ENV_Stars';
    this.stars.userData.noPick = true;
    this.group.add(this.stars);
  }

  buildLights() {
    this.sun = new THREE.DirectionalLight('#fff3dd', 3.1);
    this.sun.position.copy(this.sunDir).multiplyScalar(900);
    this.sun.castShadow = true;
    const cam = this.sun.shadow.camera;
    cam.left = -620; cam.right = 620; cam.top = 620; cam.bottom = -620;
    cam.near = 80; cam.far = 2200;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.9;
    this.sun.target.position.set(60, 40, 40);
    this.scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight('#cfe6ff', '#4a4336', 1.15);
    this.ambient = new THREE.AmbientLight('#8fb4d8', 0.35);
    this.moon = new THREE.DirectionalLight('#7fa6ff', 0);
    this.moon.position.set(420, 700, 500);

    this.group.add(this.sun, this.hemi, this.ambient, this.moon);
  }

  /** k = 1 full daylight, k = 0 night. */
  setDaylight(k) {
    this.daylight = k;
    this.uniforms.uDay.value = k;
    this.sun.intensity = 3.1 * k;
    this.hemi.intensity = 0.2 + 0.95 * k;
    this.ambient.intensity = 0.12 + 0.23 * k;
    this.moon.intensity = (1 - k) * 0.55;
    this.cloudMat.opacity = 0.18 + 0.54 * k;
    this.cloudMat.color.setRGB(0.35 + 0.65 * k, 0.4 + 0.6 * k, 0.5 + 0.5 * k);
    this.stars.material.opacity = (1 - k) * 0.9;
    this.fog.color.copy(this.nightFog).lerp(this.dayFog, k);
    this.fog.density = 0.00016 - (1 - k) * 0.00004;
  }

  update(dt) {
    for (const c of this.clouds.children) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 2100) c.position.x = -2100;
      c.lookAt(c.position.x, c.position.y, c.position.z + 1000);
    }
  }
}
