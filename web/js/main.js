// Dhruva Defence — integrated ecosystem, interactive 3D presentation.
// Application shell: builds the world, wires the interface, runs the loop.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { buildTerrain, buildVegetation, buildRocks, terrainHeight } from './scene/terrain.js';
import { Sky } from './scene/sky.js';
import { initMaterials, mat, matClone } from './scene/materials.js';
import {
  makeEFM, makeANT50, makeNodeCabinet, makeWarningStack, makeSensorPost,
  makeDisplayPanel, makeAndroidDevice,
} from './scene/devices.js';
import {
  buildAirbase, buildCommandPost, buildPerimeter, buildGeofence, buildGate,
  buildWatchtower, buildRoads, buildParkedVehicles, buildSensorPosts, buildSupportStructures,
} from './scene/installation.js';
import {
  buildSquad, buildTranslatorPair, buildAirAssets, makeDrone, buildSatellites, buildDetections,
} from './scene/actors.js';
import { LinkNetwork, monitoringRing } from './scene/links.js';
import { A, VIEWS, LDN_NODES, COLORS, ground, DETECTIONS } from './layout.js';
import { SYSTEMS, SYSTEM_BY_ID, SCENE_CALLOUTS, CHAPTERS } from './data/systems.js';
import { Simulation } from './sim.js';
import { ScreenSet } from './ui/screens.js';
import { CalloutLayer } from './ui/labels.js';
import { DetailPanel } from './ui/panel.js';
import { Hud } from './ui/hud.js';

const DEG = Math.PI / 180;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

class App {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.clock = new THREE.Clock();
    this.sim = new Simulation();
    this.screens = new ScreenSet(this.sim);
    this.pickables = [];
    this.hotspots = [];
    this.heroDevices = [];
    this.zoneGroups = {};
    this.chapterIndex = 0;
    this.playing = false;
    this.chapterTimer = 0;
    this.exhibitionScale = true;
    this.scaleBlend = 1;
    this.scaleTarget = 1;
    this.quality = 'high';

    this.initRenderer();
    this.initScene();
    this.buildWorld();
    this.initUI();
    this.bindEvents();
    this.setView('master', 0);
    this.hud.setChapter(0);
    this.hud.setScaleNote(true);

    document.getElementById('loader').classList.add('is-done');
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.frame());

    // Exposed so the presentation can be driven externally (kiosk mode,
    // console, or an operator's remote): DHRUVA.selectSystem('efm') etc.
    window.DHRUVA = this;
  }

  // -- setup ---------------------------------------------------------------
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.05, 9000);
    this.camera.position.set(...VIEWS.master.pos);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(...VIEWS.master.target);
    this.controls.maxPolarAngle = 89 * DEG;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 2600;
    this.controls.autoRotateSpeed = 0.35;

    initMaterials();
    this.sky = new Sky(this.scene);

    // Short-range fill carried by the camera. It has no reach beyond a few
    // metres, so it lifts hardware close-ups without touching the wide views.
    this.fill = new THREE.PointLight(0xfff4e2, 9, 14, 2);
    this.camera.add(this.fill);
    this.scene.add(this.camera);
  }

  /** Register a group as a selectable subsystem. */
  register(group, systemId, opts = {}) {
    group.userData = { ...group.userData, system: systemId };
    this.pickables.push(group);
    if (opts.focus !== false) {
      this.focusTargets = this.focusTargets || {};
      if (!this.focusTargets[systemId] || opts.primary) {
        this.focusTargets[systemId] = { object: group, dir: opts.dir, pad: opts.pad ?? 2.4 };
      }
    }
    if (opts.hero) {
      // The site-specific factor wins: a device's own default is only a hint.
      const scale = typeof opts.hero === 'number' ? opts.hero : (group.userData.exhibitionScale ?? 1);
      this.heroDevices.push({ group, scale });
      group.scale.setScalar(scale);
    }
    return group;
  }

  zone(name, ...children) {
    const g = new THREE.Group();
    g.name = name;
    for (const c of children) if (c) g.add(c);
    this.scene.add(g);
    this.zoneGroups[name] = g;
    return g;
  }

  buildWorld() {
    // 00_ENVIRONMENT
    this.support = buildSupportStructures();
    this.zone('00_ENVIRONMENT',
      buildTerrain(1), buildVegetation(1050), buildRocks(430), buildRoads(),
      buildAirbase(), buildParkedVehicles(), buildPerimeter(), buildWatchtower(), this.support);
    this.register(this.zoneGroups['00_ENVIRONMENT'], 'airbase', { focus: false });

    // 01_EFM_ZONE — electric field mill installation
    const efm = makeEFM();
    efm.position.copy(ground(A.efm.x, A.efm.z));
    efm.rotation.y = -35 * DEG;
    const efmPad = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.4, 24), mat('MAT_Concrete'));
    efmPad.position.copy(ground(A.efm.x, A.efm.z, 0.2));
    efmPad.receiveShadow = true;
    efmPad.name = 'EFM_Pad';
    this.zone('01_EFM_ZONE', efm, efmPad);
    this.register(efm, 'efm', { hero: 9, primary: true, pad: 2.2 });
    // Frame the sensor head itself, not the whole mast assembly.
    this.focusTargets.efm = {
      object: efm.getObjectByName('EFM_SensorAssembly'), pad: 7,
      dir: new THREE.Vector3(0.6, 0.3, 1),
    };

    // 02_LIGHTNING_NETWORK — three separated ANT-50 / LRX-1 nodes
    const ldn = this.zone('02_LIGHTNING_NETWORK');
    this.lightningNodes = LDN_NODES.map((n, i) => {
      const nodeGroup = new THREE.Group();
      nodeGroup.name = `LDN_${n.id}`;
      const ant = makeANT50();
      ant.position.copy(ground(n.x, n.z));
      const cab = makeNodeCabinet();
      cab.position.copy(ground(n.x + 6, n.z + 3));
      cab.rotation.y = 0.5;
      nodeGroup.add(ant, cab);
      ldn.add(nodeGroup);
      this.register(ant, 'lds', { hero: 11, primary: i === 0 });
      if (i === 0) {
        this.focusTargets.lds = {
          object: ant.getObjectByName('ANT50_Radome'), pad: 8,
          dir: new THREE.Vector3(0.7, 0.3, 1),
        };
      }
      this.register(cab, 'lds', { hero: 6, focus: false });
      ldn.add(monitoringRing(n.x, n.z, 66 + i * 24, COLORS.sensor, 0.35));
      return { spec: n, ant, cab };
    });

    // 03_WARNING_SYSTEM
    this.warning = makeWarningStack();
    this.warning.position.copy(ground(A.warning.x, A.warning.z));
    this.warning.rotation.y = 25 * DEG;
    this.zone('03_WARNING_SYSTEM', this.warning);
    this.register(this.warning, 'warning', { hero: 4, primary: true });
    this.focusTargets.warning = {
      object: this.warning.userData.beacon, pad: 14, dir: new THREE.Vector3(0.6, 0.25, 1),
    };

    // 04_SOLDIER_WEARABLE
    this.squad = buildSquad(this.screens.canvases.watch);
    this.zone('04_SOLDIER_WEARABLE', this.squad);
    for (const m of this.squad.userData.members) this.register(m, 'wearable', { pad: 1.8 });
    this.focusTargets.wearable = {
      object: this.squad.userData.members[0].userData.watch, pad: 11,
      dir: new THREE.Vector3(0.45, 0.42, 0.85),
    };
    this.screens.bind('watch', this.squad.userData.members[0].userData.watch.userData.display);

    // 05_COMMAND_CENTER
    this.command = buildCommandPost(this.screens.canvases);
    this.zone('05_COMMAND_CENTER', this.command);
    this.register(this.command, 'command', { pad: 2.0 });
    this.screens.bind('command', this.command.getObjectByName('Command_MainDisplay')?.userData.display);
    this.commandDisplays = [];
    this.command.traverse((o) => {
      if (o.userData?.display) this.commandDisplays.push(o.userData.display);
    });
    this.register(this.command.getObjectByName('GroundStation_Dish_01'), 'drone', { primary: true, pad: 3 });

    // 06_TRANSLATOR
    const gate = buildGate();
    this.translator = buildTranslatorPair(this.screens.canvases.translator);
    this.zone('06_TRANSLATOR', gate, this.translator);
    this.register(this.translator, 'translator', { primary: true, pad: 3.2 });
    this.gateFlags = gate.userData.flags;
    this.screens.bind('translator', this.translator.userData.device?.userData.display);

    // 07_OPTIONAL_BORDER_TECH — clearly secondary to the five primary systems
    this.geofence = buildGeofence();
    this.sensorPosts = buildSensorPosts(makeSensorPost);
    this.detections = buildDetections();
    this.drone = makeDrone();
    this.satellites = buildSatellites();
    this.zone('07_OPTIONAL_BORDER_TECH',
      this.geofence, this.sensorPosts, this.detections, this.drone, this.satellites);
    for (const p of this.sensorPosts.children) this.register(p, 'border', { hero: 1.7, pad: 2.6 });
    this.register(this.geofence, 'geofence', { focus: false });
    this.focusTargets.geofence = { object: this.detections.userData.items[2], pad: 12 };
    this.register(this.drone, 'drone', { focus: false });
    for (const s of this.satellites.userData.sats) this.register(s, 'satellite', { pad: 3.4 });
    for (const d of this.detections.userData.items) this.register(d, 'border', { focus: false });

    // Air assets
    this.air = buildAirAssets();
    this.scene.add(this.air);
    this.zoneGroups['00_ENVIRONMENT'].add(this.air);

    // 08_DATA_VISUALIZATION
    this.links = new LinkNetwork();
    this.scene.add(this.links.group);
    this.zoneGroups['08_DATA_VISUALIZATION'] = this.links.group;

    // Hotspot markers (equivalents of the HOTSPOT_ empties in the Blender master)
    this.buildHotspots();
  }

  buildHotspots() {
    const g = new THREE.Group();
    g.name = '11_PRESENTATION_UI';
    for (const sys of SYSTEMS) {
      if (sys.anchor.fixedY !== undefined) continue;
      const pos = ground(sys.anchor.x, sys.anchor.z, 0.6);
      const ringMat = new THREE.MeshBasicMaterial({
        color: COLORS.gold, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
        depthWrite: false, fog: false,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.6, 40), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(pos);
      ring.name = `HOTSPOT_${sys.id.toUpperCase()}`;
      ring.userData = { system: sys.id, hotspot: true, baseOpacity: 0.55 };
      g.add(ring);
      this.hotspots.push(ring);
      this.pickables.push(ring);
    }
    this.scene.add(g);
    this.zoneGroups['11_PRESENTATION_UI'] = g;
  }

  // -- interface -----------------------------------------------------------
  initUI() {
    this.callouts = new CalloutLayer(
      document.getElementById('callouts'), document.getElementById('leaders'));

    const offsets = {
      wearable: [-150, -150], efm: [-190, -120], lds: [-60, -140], warning: [-230, -60],
      translator: [40, -140], drone: [90, -120], satellite: [110, -60], airbase: [-160, 60],
      border: [80, -160], geofence: [120, -90], command: [90, -150],
    };
    for (const sys of SYSTEMS) {
      const pos = sys.anchor.fixedY !== undefined
        ? new THREE.Vector3(sys.anchor.x, sys.anchor.fixedY, sys.anchor.z)
        : ground(sys.anchor.x, sys.anchor.z, sys.anchor.lift);
      this.callouts.add({
        title: sys.short, sub: sys.caption, position: pos, system: sys.id,
        offset: offsets[sys.id], maxDistance: 3000,
        onSelect: (id) => this.selectSystem(id),
      });
    }
    for (const c of SCENE_CALLOUTS) {
      this.callouts.add({
        title: c.text, sub: c.sub, position: ground(c.x, c.z, c.lift), system: c.system,
        kind: 'plain', offset: [-80, -70], maxDistance: 1800,
        onSelect: (id) => this.selectSystem(id),
      });
    }
    for (const d of DETECTIONS) {
      this.callouts.add({
        title: d.label, position: ground(d.x, d.z, d.kind === 'vehicle' ? 4 : 2.2),
        kind: d.kind === 'vehicle' ? 'detect-vehicle' : 'detect-person',
        offset: [-40, -64], maxDistance: 900, system: 'border',
        onSelect: (id) => this.selectSystem(id),
      });
    }
    // Translator exchange at the meeting point.
    this.callouts.add({
      title: 'नमस्ते', position: ground(A.gate.x - 2.6, A.gate.z - 1, 2.2),
      kind: 'speech', offset: [-100, -60], maxDistance: 320,
    });
    this.callouts.add({
      title: '你好', position: ground(A.gate.x + 2.8, A.gate.z - 1.6, 2.2),
      kind: 'speech', offset: [30, -60], maxDistance: 320,
    });

    this.panel = new DetailPanel(document.getElementById('panel'), this.sim, {
      onClose: () => {
        this.callouts.setFocus(null);
        this.callouts.panelOpen = false;
        this.hud.setActiveSystem(null);
        this.isolate(null);
        this.activeSystem = null;
      },
      onFocus: (id) => this.flyToSystem(id),
      onIsolate: (id) => this.isolate(id),
      onTrace: (id) => this.traceLinks(id),
    });

    this.hud = new Hud(this);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = null;
    this.canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 6) return; // dragging the camera, not selecting
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
      ray.setFromCamera(pointer, this.camera);
      const hits = ray.intersectObjects(this.pickables, true);
      for (const hit of hits) {
        if (hit.object.userData?.noPick) continue;
        let o = hit.object;
        while (o && !o.userData?.system) o = o.parent;
        if (o?.userData?.system) { this.selectSystem(o.userData.system); return; }
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input, select, textarea')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 8) { this.goToChapter(n - 1); return; }
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); this.togglePresentation(); break;
        case 'l': this.toggleCheckbox('tgl-labels'); break;
        case 'd': this.toggleCheckbox('tgl-links'); break;
        case 'n': this.toggleCheckbox('tgl-night'); break;
        case 's': this.toggleCheckbox('tgl-scale'); break;
        case 'escape': this.panel.close(); break;
        case 'r': this.setView('master'); break;
        case '?': document.getElementById('intro').classList.add('is-open'); break;
        default: break;
      }
    });
  }

  toggleCheckbox(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = !el.checked;
    el.dispatchEvent(new Event('change'));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.panel.resizeCanvas();
  }

  // -- camera --------------------------------------------------------------
  setView(name, duration = 1.7) {
    const v = VIEWS[name];
    if (!v) return;
    this.flyTo(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target), v.fov, duration);
  }

  flyTo(pos, target, fov = 40, duration = 1.7) {
    if (duration <= 0) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      return;
    }
    this.fly = {
      t: 0, duration,
      fromPos: this.camera.position.clone(), toPos: pos.clone(),
      fromTarget: this.controls.target.clone(), toTarget: target.clone(),
      fromFov: this.camera.fov, toFov: fov,
    };
  }

  /** Frame a specific object using its bounding sphere — works at any scale. */
  flyToSystem(id) {
    const entry = this.focusTargets?.[id];
    const sys = SYSTEM_BY_ID[id];
    if (!entry?.object) { this.setView(sys?.view || 'master'); return; }
    const box = new THREE.Box3().setFromObject(entry.object);
    if (box.isEmpty()) { this.setView(sys?.view || 'master'); return; }
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    // Large composites (the command post, the airbase) frame far better from a
    // hand-authored pose than from an automatic bounding-sphere fit.
    if (sphere.radius > 22 && VIEWS[sys?.view]) { this.setView(sys.view); return; }
    const dir = (entry.dir ? entry.dir.clone() : new THREE.Vector3(0.62, 0.42, 1)).normalize();
    const dist = Math.max(0.35, sphere.radius * (entry.pad ?? 2.4));
    const pos = sphere.center.clone().add(dir.multiplyScalar(dist));
    // Never place the camera under the ground.
    const minY = terrainHeight(pos.x, pos.z) + 0.8;
    pos.y = Math.max(pos.y, minY);
    this.flyTo(pos, sphere.center.clone(), 38, 1.7);
  }

  // -- selection & isolation ----------------------------------------------
  selectSystem(id) {
    if (!SYSTEM_BY_ID[id]) return;
    this.panel.open(id);
    this.callouts.panelOpen = true;
    this.hud.setActiveSystem(id);
    this.callouts.setFocus(id);
    this.flyToSystem(id);
    this.activeSystem = id;
  }

  isolate(id) {
    const keep = new Set(['00_ENVIRONMENT', '09_LIGHTING', '10_CAMERAS', '11_PRESENTATION_UI']);
    const zoneOf = id ? SYSTEM_BY_ID[id]?.zone : null;
    for (const [name, group] of Object.entries(this.zoneGroups)) {
      if (name === '08_DATA_VISUALIZATION') continue;
      group.visible = !id || keep.has(name) || name === zoneOf;
    }
  }

  traceLinks(id) {
    if (!id) {
      for (const k of Object.keys(this.links.classes)) {
        this.links.setClassVisible(k, true);
        const cb = document.querySelector(`[data-link="${k}"]`);
        if (cb) cb.checked = true;
      }
      return;
    }
    const map = {
      efm: ['sensor'], lds: ['network'], warning: ['warning'], wearable: ['health'],
      translator: ['translation'], command: ['network', 'warning'], border: ['sensor'],
      geofence: ['sensor'], drone: ['network'], satellite: ['satellite'], airbase: ['network'],
    };
    const on = new Set(map[id] || []);
    for (const k of Object.keys(this.links.classes)) {
      const visible = on.has(k);
      this.links.setClassVisible(k, visible);
      const cb = document.querySelector(`[data-link="${k}"]`);
      if (cb) cb.checked = visible;
    }
  }

  // -- presentation --------------------------------------------------------
  goToChapter(index) {
    const i = ((index % CHAPTERS.length) + CHAPTERS.length) % CHAPTERS.length;
    this.chapterIndex = i;
    this.chapterTimer = 0;
    const c = CHAPTERS[i];
    this.hud.setChapter(i);
    if (c.system) {
      this.hud.setActiveSystem(c.system);
      this.callouts.setFocus(c.system);
      this.panel.open(c.system);
      this.flyToSystem(c.system);
    } else {
      this.hud.setActiveSystem(null);
      this.callouts.setFocus(null);
      this.panel.close();
      this.setView(c.view);
    }
  }

  togglePresentation() {
    this.playing = !this.playing;
    this.chapterTimer = 0;
    this.hud.setPlaying(this.playing);
    if (this.playing) this.goToChapter(this.chapterIndex);
  }

  // -- presentation options ------------------------------------------------
  setNight(on) {
    this.nightTarget = on ? 0 : 1;
    if (on) this.sim.log('Presentation', 'Night / emergency demonstration view', 'warn');
  }

  setExhibitionScale(on) {
    this.exhibitionScale = on;
    this.scaleTarget = on ? 1 : 0;
    this.hud.setScaleNote(on);
  }

  setQuality(level) {
    this.quality = level;
    const dpr = window.devicePixelRatio;
    if (level === 'high') {
      this.renderer.setPixelRatio(Math.min(2, dpr));
      this.renderer.shadowMap.enabled = true;
      this.sky.sun.shadow.mapSize.set(2048, 2048);
    } else if (level === 'balanced') {
      this.renderer.setPixelRatio(Math.min(1.5, dpr));
      this.renderer.shadowMap.enabled = true;
      this.sky.sun.shadow.mapSize.set(1024, 1024);
    } else {
      this.renderer.setPixelRatio(1);
      this.renderer.shadowMap.enabled = false;
    }
    this.sky.sun.shadow.map?.dispose();
    this.sky.sun.shadow.map = null;
    this.scene.traverse((o) => { if (o.isMesh) o.material.needsUpdate = true; });
  }

  // -- per-frame -----------------------------------------------------------
  updateAlertVisuals(dt) {
    const level = this.sim.level;
    this.links.setAlertLevel(level);

    const pulse = 0.5 + 0.5 * Math.sin(this.sim.time * (level === 'ALERT' ? 9 : 3.2));
    const w = this.warning.userData;
    if (level === 'NORMAL') {
      w.beaconMat.emissive.setHex(0x1a1d20);
      w.beaconMat.emissiveIntensity = 0.2;
      w.light.intensity = 0;
      w.stateLamp.material.emissive.setHex(COLORS.health);
      w.stateLamp.material.emissiveIntensity = 2.4;
    } else {
      const color = level === 'CAUTION' ? COLORS.warning : COLORS.alert;
      w.beaconMat.emissive.setHex(color);
      w.beaconMat.emissiveIntensity = 1.2 + pulse * 5.2;
      w.light.color.setHex(color);
      w.light.intensity = (level === 'ALERT' ? 900 : 320) * (0.25 + pulse);
      w.light.distance = 260;
      w.stateLamp.material.emissive.setHex(color);
      w.stateLamp.material.emissiveIntensity = 1 + pulse * 3;
    }

    // Restricted-zone boundary breathes, and turns red when a detection is inside.
    const breach = this.sim.detections.some((d) => d.inZone);
    const gm = this.geofence.userData.dashMat;
    gm.emissive.setHex(breach ? COLORS.alert : 0xff6a3d);
    gm.emissiveIntensity = 1.4 + pulse * (breach ? 2.6 : 0.7);

    // Detection brackets pulse.
    for (const item of this.detections.userData.items) {
      const s = 1 + Math.sin(this.sim.time * 2.4) * 0.015;
      item.userData.box.scale.setScalar(s);
    }

    // Site lighting comes on as daylight falls.
    const lamp = this.support?.userData.lampMaterial;
    if (lamp) lamp.emissiveIntensity = 0.04 + (1 - this.sky.daylight) * 3.4;

    // Mast obstruction light.
    const ob = this.command.userData.obstructionLight;
    if (ob) ob.emissiveIntensity = 0.6 + pulse * 2.6;

    // Hotspot rings.
    for (const h of this.hotspots) {
      const active = this.activeSystem === h.userData.system;
      h.material.opacity = (active ? 0.85 : h.userData.baseOpacity) * (0.55 + pulse * 0.45);
      h.scale.setScalar(active ? 1.15 + pulse * 0.1 : 1);
    }
  }

  updateAssets(dt) {
    const t = this.sim.time;

    for (const heli of this.air.userData.helis) {
      const p = heli.userData.path;
      const a = t * p.speed + p.phase;
      const x = p.center[0] + Math.cos(a) * p.radius;
      const z = p.center[1] + Math.sin(a) * p.radius;
      heli.position.set(x, p.height + Math.sin(t * 0.7 + p.phase) * 4, z);
      heli.rotation.y = -a + (p.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
      heli.rotation.z = p.speed > 0 ? -0.12 : 0.12;
      heli.userData.mainRotor.rotation.y += dt * 26;
      heli.userData.tailRotor.rotation.x += dt * 34;
    }

    const dp = this.drone.userData.path;
    const da = t * dp.speed;
    this.drone.position.set(
      dp.center[0] + Math.cos(da) * dp.radius,
      dp.height + Math.sin(t * 0.8) * 6,
      dp.center[1] + Math.sin(da) * dp.radius,
    );
    this.drone.rotation.y = -da - Math.PI / 2;
    this.drone.rotation.x = Math.sin(t * 0.5) * 0.04;
    for (const r of this.drone.userData.rotors) r.rotation.y += dt * 42;
    this.links.updateDroneLink(this.drone.position);

    for (const sat of this.satellites.userData.sats) {
      const home = sat.userData.home;
      sat.position.x = home.x + Math.sin(t * 0.05 + sat.userData.phase) * 26;
      sat.position.y = home.y + Math.sin(t * 0.08 + sat.userData.phase) * 8;
      sat.rotation.y = Math.sin(t * 0.06 + sat.userData.phase) * 0.25;
      if (sat.userData.map) sat.userData.map.lookAt(this.camera.position);
    }

    // Flags and dishes.
    for (const cloth of this.gateFlags || []) {
      const pos = cloth.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(t * 3 + x * 2.2) * 0.12 * (x + 1.5));
      }
      pos.needsUpdate = true;
    }
    for (const dish of this.command.userData.dishes || []) {
      dish.userData.head.rotation.y = Math.sin(t * 0.12) * 0.6;
    }

    // Searchlight sweep at night.
    const tower = this.scene.getObjectByName('ZONE_Watchtower');
    if (tower?.userData.searchlight) tower.userData.searchlight.rotation.y = Math.sin(t * 0.25) * 0.8;
  }

  updateScale(dt) {
    const k = this.scaleTarget;
    if (Math.abs(this.scaleBlend - k) < 0.001) return;
    this.scaleBlend += (k - this.scaleBlend) * Math.min(1, dt * 3.2);
    for (const { group, scale } of this.heroDevices) {
      group.scale.setScalar(1 + (scale - 1) * this.scaleBlend);
    }
  }

  frame() {
    // Simulation and asset motion are clamped so a stall never jumps the scene;
    // camera flights and the tour use real elapsed time so they still take the
    // same number of seconds on a slow GPU.
    const raw = Math.min(0.5, this.clock.getDelta());
    const dt = Math.min(0.05, raw);

    this.sim.update(dt);
    this.screens.update(dt);

    // Camera flight.
    if (this.fly) {
      this.fly.t += raw;
      const k = easeInOut(clamp01(this.fly.t / this.fly.duration));
      this.camera.position.lerpVectors(this.fly.fromPos, this.fly.toPos, k);
      this.controls.target.lerpVectors(this.fly.fromTarget, this.fly.toTarget, k);
      this.camera.fov = this.fly.fromFov + (this.fly.toFov - this.fly.fromFov) * k;
      this.camera.updateProjectionMatrix();
      if (this.fly.t >= this.fly.duration) this.fly = null;
    }

    // Presentation auto-advance.
    if (this.playing) {
      this.chapterTimer += raw;
      if (this.chapterTimer > 12) this.goToChapter(this.chapterIndex + 1);
    }

    // Day / night blend.
    if (this.nightTarget !== undefined && Math.abs(this.sky.daylight - this.nightTarget) > 0.002) {
      this.sky.setDaylight(this.sky.daylight + (this.nightTarget - this.sky.daylight) * Math.min(1, dt * 1.6));
    }

    this.updateScale(dt);
    this.updateAssets(dt);
    this.updateAlertVisuals(dt);
    this.links.update(this.sim.time);
    this.sky.update(dt);
    this.controls.update();

    this.callouts.update(this.camera, window.innerWidth, window.innerHeight);
    this.panel.update(dt);
    this.hud.update();

    this.renderer.render(this.scene, this.camera);
  }
}

window.addEventListener('error', (e) => {
  const loader = document.getElementById('loader');
  if (loader && !loader.classList.contains('is-done')) {
    loader.querySelector('.loader__msg').textContent = `Failed to start: ${e.message}`;
    loader.classList.add('is-error');
  }
});

new App();
