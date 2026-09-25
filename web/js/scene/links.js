// Animated information links. These represent data paths, not physical beams:
// thin, restrained, colour-coded per data class, and individually switchable.

import * as THREE from 'three';
import { ground, A, LDN_NODES, SQUAD, SENSOR_POSTS, fencePoint, COLORS, SATELLITES } from '../layout.js';
import { terrainHeight } from './terrain.js';

const VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform vec3 uColor;
  uniform float uTime, uSpeed, uDashes, uOpacity, uGlow;
  void main() {
    float f = fract(vUv.x * uDashes - uTime * uSpeed);
    // Packet: a sharp leading edge with a short trail.
    float packet = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.22, 0.52, f));
    float base = 0.06;                       // faint continuous path
    float a = (base + packet * 0.95) * uOpacity;
    // Soften across the tube so it reads as a line, not a pipe.
    float edge = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.65, 1.0, vUv.y));
    a *= 0.55 + edge * 0.75;
    // Fade out close to the camera so a link never washes out a hardware close-up.
    float d = distance(cameraPosition, vWorld);
    a *= smoothstep(5.0, 28.0, d);
    gl_FragColor = vec4(uColor * (1.0 + packet * uGlow), a);
  }
`;

function linkMaterial(color, opts = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uSpeed: { value: opts.speed ?? 0.35 },
      uDashes: { value: opts.dashes ?? 6 },
      uOpacity: { value: opts.opacity ?? 0.7 },
      uGlow: { value: opts.glow ?? 0.9 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    side: THREE.DoubleSide,
  });
}

/** Shallow arc between two world points — kept low so links read as ground
 *  infrastructure rather than as arcs across the sky. */
function arcCurve(a, b, lift = 0.045, sag = 0) {
  const dist = a.distanceTo(b);
  const rise = Math.min(dist * lift, 16) - sag;
  const mid = a.clone().lerp(b, 0.5);
  mid.y = Math.max(a.y, b.y) + rise;
  const q1 = a.clone().lerp(mid, 0.5);
  q1.y += rise * 0.34;
  const q2 = mid.clone().lerp(b, 0.5);
  q2.y += rise * 0.34;
  return new THREE.CatmullRomCurve3([a, q1, mid, q2, b]);
}

export class LinkNetwork {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = '08_DATA_VISUALIZATION';
    this.links = [];
    this.classes = {
      sensor: { color: COLORS.sensor, label: 'Sensor data', visible: true },
      network: { color: COLORS.network, label: 'Network / backhaul', visible: true },
      health: { color: COLORS.health, label: 'Health telemetry', visible: true },
      warning: { color: COLORS.warning, label: 'Warning / alert', visible: true },
      translation: { color: COLORS.translation, label: 'Translation', visible: true },
      satellite: { color: COLORS.satellite, label: 'Satellite link', visible: true },
    };
    this.build();
  }

  add(kind, a, b, opts = {}) {
    const curve = opts.curve || arcCurve(a, b, opts.lift ?? 0.045);
    const radius = opts.radius ?? 0.45;
    const geo = new THREE.TubeGeometry(curve, opts.segments ?? 64, radius, 6, false);
    const material = linkMaterial(opts.color ?? this.classes[kind].color, opts);
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = `LINK_${kind}_${opts.name || this.links.length}`;
    mesh.userData = { noPick: true, kind, material };
    mesh.renderOrder = 4;
    this.group.add(mesh);
    this.links.push(mesh);
    return mesh;
  }

  build() {
    const server = ground(A.server.x, A.server.z, 6);
    const command = ground(A.command.x, A.command.z, 9);

    // Environmental sensing -> processing
    this.add('sensor', ground(A.efm.x, A.efm.z, 3.4), server, { name: 'EFM_to_Server', dashes: 8, speed: 0.3 });
    for (const n of LDN_NODES) {
      this.add('network', ground(n.x, n.z, 3.0), server, { name: `${n.id}_to_Server`, dashes: 10, speed: 0.26 });
    }
    // Node-to-node timing/synchronisation between detection sites.
    this.add('network', ground(LDN_NODES[1].x, LDN_NODES[1].z, 2.6), ground(LDN_NODES[0].x, LDN_NODES[0].z, 2.6),
      { name: 'Node02_Node01', dashes: 14, speed: 0.16, opacity: 0.6, lift: 0.1 });
    this.add('network', ground(LDN_NODES[2].x, LDN_NODES[2].z, 2.6), ground(LDN_NODES[0].x, LDN_NODES[0].z, 2.6),
      { name: 'Node03_Node01', dashes: 14, speed: 0.16, opacity: 0.6, lift: 0.1 });

    // Processing -> command application
    this.add('network', server, command, { name: 'Server_to_Command', dashes: 5, speed: 0.4, lift: 0.12 });

    // Command -> early warning stack (alert path)
    this.warningLink = this.add('warning', command, ground(A.warning.x, A.warning.z, 3.2),
      { name: 'Command_to_Warning', dashes: 7, speed: 0.5 });

    // Perimeter sensors -> command
    for (const s of SENSOR_POSTS) {
      const p = fencePoint(s.t, 4.2);
      this.add('sensor', p, command, { name: `${s.id}_to_Command`, dashes: 9, speed: 0.28, opacity: 0.75, radius: 0.8 });
    }

    // Soldier wearables -> command (health telemetry)
    for (const s of SQUAD) {
      this.add('health', ground(s.x, s.z, 1.3), command,
        { name: `${s.id}_telemetry`, dashes: 9, speed: 0.22, opacity: 0.85, radius: 0.85 });
    }

    // Translator device <-> processing
    this.add('translation', ground(A.gate.x, A.gate.z, 1.6), server,
      { name: 'Translator_to_Server', dashes: 8, speed: 0.32, radius: 0.9 });

    // Satellite links
    for (const s of SATELLITES) {
      const satPos = new THREE.Vector3(...s.pos);
      const gs = ground(A.command.x - 20, A.command.z - 4, 6);
      const curve = new THREE.CatmullRomCurve3([
        satPos, satPos.clone().lerp(gs, 0.45), gs,
      ]);
      this.add('satellite', satPos, gs, {
        name: `${s.id}_downlink`, curve, radius: 1.5, dashes: 12, speed: 0.2, opacity: 0.55, segments: 40,
      });
    }

    // Drone -> ground station
    this.droneLink = this.add('network', new THREE.Vector3(386, 200, -60), ground(A.command.x - 20, A.command.z - 4, 6),
      { name: 'Drone_to_GroundStation', dashes: 9, speed: 0.34, radius: 1.1, lift: 0.05 });
  }

  setClassVisible(kind, visible) {
    this.classes[kind].visible = visible;
    for (const l of this.links) {
      if (l.userData.kind === kind) l.visible = visible && this.group.visible;
    }
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  /** Dim every class except the ones listed; pass null to restore. */
  setEmphasis(kinds) {
    for (const l of this.links) {
      const base = l.userData.baseOpacity ??
        (l.userData.baseOpacity = l.userData.material.uniforms.uOpacity.value);
      const on = !kinds || kinds.includes(l.userData.kind);
      l.userData.material.uniforms.uOpacity.value = on ? base : base * 0.12;
    }
  }

  /** Re-point the drone downlink as the drone flies. */
  updateDroneLink(dronePos) {
    const gs = ground(A.command.x - 20, A.command.z - 4, 6);
    const curve = arcCurve(dronePos.clone(), gs, 0.05);
    this.droneLink.geometry.dispose();
    this.droneLink.geometry = new THREE.TubeGeometry(curve, 40, 1.1, 6, false);
  }

  /** Escalation colours the warning path and speeds up the packets. */
  setAlertLevel(level) {
    const map = { NORMAL: COLORS.health, CAUTION: COLORS.warning, ALERT: COLORS.alert };
    const speed = { NORMAL: 0.35, CAUTION: 0.6, ALERT: 1.1 };
    this.warningLink.userData.material.uniforms.uColor.value.setHex(map[level]);
    this.warningLink.userData.material.uniforms.uSpeed.value = speed[level];
  }

  update(t) {
    for (const l of this.links) l.userData.material.uniforms.uTime.value = t;
  }
}

/** Ground rings used to mark a monitoring radius around a node. */
export function monitoringRing(x, z, radius, color, opacity = 0.5) {
  const pts = [];
  const seg = 96;
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const pz = z + Math.sin(a) * radius;
    pts.push(new THREE.Vector3(px, terrainHeight(px, pz) + 0.6, pz));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color, transparent: true, opacity, depthWrite: false, fog: false,
  }));
  line.name = 'MonitoringRing';
  line.userData.noPick = true;
  return line;
}
