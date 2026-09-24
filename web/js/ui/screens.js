// Canvas dashboards. The same renderers drive the in-scene displays (as
// textures) and the HTML detail panel, so the operator picture is identical
// wherever it appears. Layout is a professional dark industrial UI — not a
// fictional radar console.

const C = {
  bg: '#080d14',
  panel: '#0e1620',
  panelHi: '#132132',
  line: '#1e2e40',
  text: '#d6e3ee',
  dim: '#7d93a6',
  cyan: '#27b4e8',
  gold: '#d9a233',
  green: '#2fd06a',
  amber: '#ff9d2e',
  red: '#ff3b30',
  violet: '#9b6bff',
};

const LEVEL_COLOR = { NORMAL: C.green, CAUTION: C.amber, ALERT: C.red };

function rr(ctx, x, y, w, h, r = 6) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function panel(ctx, x, y, w, h, title, accent = C.cyan) {
  ctx.fillStyle = C.panel;
  rr(ctx, x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1.2;
  rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 8); ctx.stroke();
  if (title) {
    ctx.fillStyle = accent;
    ctx.fillRect(x + 12, y + 14, 3, 11);
    ctx.fillStyle = C.dim;
    ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(title.toUpperCase(), x + 22, y + 24);
  }
  return { x: x + 14, y: y + (title ? 38 : 14), w: w - 28, h: h - (title ? 52 : 28) };
}

function pill(ctx, x, y, text, color, fill = false) {
  ctx.font = '700 12px ui-sans-serif, system-ui, sans-serif';
  const w = ctx.measureText(text).width + 18;
  rr(ctx, x, y, w, 20, 10);
  if (fill) { ctx.fillStyle = color; ctx.fill(); ctx.fillStyle = '#04070b'; }
  else { ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke(); ctx.fillStyle = color; }
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 9, y + 14);
  return w;
}

function label(ctx, x, y, text, color = C.dim, size = 12, weight = 500) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

function mono(ctx, x, y, text, color = C.text, size = 14, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px ui-monospace, "SF Mono", Menlo, monospace`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function background(ctx, w, h) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);
  // Faint engineering grid.
  ctx.strokeStyle = 'rgba(39,180,232,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

function header(ctx, w, sim, title, sub) {
  ctx.fillStyle = C.panelHi;
  ctx.fillRect(0, 0, w, 44);
  ctx.fillStyle = C.gold;
  ctx.fillRect(0, 0, 4, 44);
  label(ctx, 18, 27, title, C.text, 16, 700);
  if (sub) label(ctx, 20 + ctx.measureText(title).width + 14, 27, sub, C.dim, 12, 500);
  const lvl = sim.level;
  ctx.save();
  pill(ctx, w - 210, 12, `STATE · ${lvl}`, LEVEL_COLOR[lvl], lvl !== 'NORMAL');
  ctx.restore();
  mono(ctx, w - 18, 28, sim.clock(), C.dim, 13, 'right');
}

// --- Modules ---------------------------------------------------------------

function fieldChart(ctx, box, sim, opts = {}) {
  const { x, y, w, h } = box;
  const data = sim.fieldHistory;
  const maxV = Math.max(10, ...data.map(Math.abs)) * 1.15;
  ctx.save();
  // Axes + gridlines in kV/m.
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gy = y + (h * i) / 4;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
    mono(ctx, x - 6, gy + 4, (maxV - (2 * maxV * i) / 4).toFixed(0), C.dim, 10, 'right');
  }
  // Series.
  ctx.beginPath();
  data.forEach((v, i) => {
    const px = x + (i / (data.length - 1)) * w;
    const py = y + h / 2 - (v / maxV) * (h / 2);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.strokeStyle = LEVEL_COLOR[sim.level];
  ctx.lineWidth = 2;
  ctx.stroke();
  // Fill under the trace.
  ctx.lineTo(x + w, y + h / 2);
  ctx.lineTo(x, y + h / 2);
  ctx.closePath();
  ctx.fillStyle = LEVEL_COLOR[sim.level] + '22';
  ctx.fill();

  mono(ctx, x + w - 4, y + 18, `${sim.field.toFixed(2)} kV/m`, C.text, opts.big ? 22 : 16, 'right');
  label(ctx, x + w - 4 - ctx.measureText(`${sim.field.toFixed(2)} kV/m`).width, y + 32,
    'atmospheric field · synthetic', C.dim, 9);
  label(ctx, x, y + h + 16, 'Warning threshold: not configured', C.dim, 11);
  ctx.restore();
}

function strikeMap(ctx, box, sim) {
  const { x, y, w, h } = box;
  const cx = x + w / 2, cy = y + h / 2;
  const R = Math.min(w, h) / 2 - 8;
  ctx.save();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 3, 0, Math.PI * 2); ctx.stroke();
    mono(ctx, cx + 4, cy - (R * i) / 3 + 12, `${i * 10} km`, C.dim, 9);
  }
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

  // Detection nodes.
  sim.nodes.forEach((n, i) => {
    const a = (i / sim.nodes.length) * Math.PI * 2 + 0.6;
    const px = cx + Math.cos(a) * R * 0.55, py = cy + Math.sin(a) * R * 0.55;
    ctx.fillStyle = n.online ? C.cyan : C.dim;
    ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
    label(ctx, px + 8, py + 4, n.id, C.dim, 10);
  });

  // Strikes, faded by age.
  for (const s of sim.strikes) {
    const age = sim.time - s.t;
    const alpha = Math.max(0, 1 - age / 90);
    if (alpha <= 0) continue;
    const r = (s.distance / 30) * R;
    const px = cx + Math.cos(s.bearing) * r;
    const py = cy + Math.sin(s.bearing) * r;
    ctx.strokeStyle = `rgba(255,157,46,${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px - 5, py - 6); ctx.lineTo(px + 1, py - 1);
    ctx.lineTo(px - 2, py + 1); ctx.lineTo(px + 5, py + 7);
    ctx.stroke();
  }
  ctx.fillStyle = C.gold;
  ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function strikeList(ctx, box, sim) {
  const { x, y, w } = box;
  label(ctx, x, y + 2, 'TIME      RANGE     NODE', C.dim, 10, 600);
  sim.strikes.slice(0, 6).forEach((s, i) => {
    const yy = y + 22 + i * 18;
    const age = sim.time - s.t;
    const col = age < 20 ? C.amber : C.dim;
    mono(ctx, x, yy, `-${age.toFixed(0).padStart(3, '0')}s`, col, 11);
    mono(ctx, x + 66, yy, `${s.distance.toFixed(1)} km`, col, 11);
    mono(ctx, x + 146, yy, s.node, col, 11);
  });
  if (!sim.strikes.length) label(ctx, x, y + 24, 'No strikes in window', C.dim, 11);
}

function squadTable(ctx, box, sim, compact = false) {
  const { x, y, w } = box;
  const rowH = compact ? 22 : 30;
  label(ctx, x, y + 2, 'ID              STATUS      HR*    SpO2*   BATT   LINK', C.dim, 10, 600);
  sim.squad.forEach((s, i) => {
    const yy = y + 20 + i * rowH;
    const col = s.state === 'OK' ? C.green : s.state === 'NO LINK' ? C.red : C.amber;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent';
    ctx.fillRect(x - 6, yy - 13, w + 12, rowH - 4);
    label(ctx, x, yy, s.id, C.text, 12, 600);
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x + 108, yy - 4, 4, 0, Math.PI * 2); ctx.fill();
    label(ctx, x + 118, yy, s.state, col, 11, 600);
    mono(ctx, x + 196, yy, `${s.hr.toFixed(0)}`, C.dim, 11);
    mono(ctx, x + 246, yy, `${s.spo2.toFixed(0)}%`, C.dim, 11);
    mono(ctx, x + 312, yy, `${s.battery.toFixed(0)}%`, C.dim, 11);
    mono(ctx, x + 372, yy, s.link ? 'OK' : '--', s.link ? C.dim : C.red, 11);
  });
  label(ctx, x, y + 26 + sim.squad.length * rowH,
    '* placeholder fields — supported metrics pending hardware confirmation', C.dim, 10);
}

function alertLog(ctx, box, sim) {
  const { x, y, w, h } = box;
  const rows = Math.floor(h / 20);
  sim.events.slice(0, rows).forEach((e, i) => {
    const yy = y + 14 + i * 20;
    const col = e.level === 'alert' ? C.red : e.level === 'warn' ? C.amber : C.dim;
    ctx.fillStyle = col;
    ctx.fillRect(x, yy - 8, 3, 10);
    mono(ctx, x + 10, yy, `${Math.max(0, sim.time - e.t).toFixed(0)}s`, C.dim, 10);
    label(ctx, x + 48, yy, e.source, col, 11, 700);
    label(ctx, x + 132, yy, e.text, C.text, 11, 400);
  });
}

function nodeHealth(ctx, box, sim) {
  const { x, y, w } = box;
  sim.nodes.forEach((n, i) => {
    const yy = y + 16 + i * 30;
    ctx.fillStyle = n.online ? C.green : C.red;
    ctx.beginPath(); ctx.arc(x + 5, yy - 4, 4.5, 0, Math.PI * 2); ctx.fill();
    label(ctx, x + 18, yy, n.id, C.text, 12, 600);
    label(ctx, x + 96, yy, n.online ? 'ONLINE' : 'OFFLINE', n.online ? C.green : C.red, 11, 600);
    label(ctx, x + 168, yy, n.gps ? 'GPS LOCK' : 'NO GPS', C.dim, 11);
    mono(ctx, x + w, yy, `noise ${n.noise.toFixed(0)}`, C.dim, 11, 'right');
  });
}

function stateLadder(ctx, box, sim) {
  const { x, y, w } = box;
  const states = ['NORMAL', 'CAUTION', 'ALERT'];
  states.forEach((s, i) => {
    const yy = y + i * 46;
    const active = sim.level === s;
    ctx.fillStyle = active ? LEVEL_COLOR[s] + '26' : 'rgba(255,255,255,0.02)';
    rr(ctx, x, yy, w, 38, 6); ctx.fill();
    ctx.strokeStyle = active ? LEVEL_COLOR[s] : C.line;
    ctx.lineWidth = active ? 2 : 1;
    rr(ctx, x + 0.5, yy + 0.5, w - 1, 37, 6); ctx.stroke();
    ctx.fillStyle = active ? LEVEL_COLOR[s] : C.dim;
    ctx.beginPath(); ctx.arc(x + 20, yy + 19, 7, 0, Math.PI * 2); ctx.fill();
    label(ctx, x + 38, yy + 24, s, active ? LEVEL_COLOR[s] : C.dim, 14, 700);
    const desc = s === 'NORMAL' ? 'Monitoring' : s === 'CAUTION' ? 'Field rising / activity nearby' : 'Beacon · sounder · notification';
    label(ctx, x + 124, yy + 24, desc, C.dim, 11);
  });
}

// --- Dashboard routers -----------------------------------------------------

export function drawCommand(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'DHRUVA COMMAND APPLICATION', 'Integrated operating picture · demonstration data');
  const pad = 14;
  const top = 56;
  const colW = (w - pad * 4) / 3;
  const rowH = (h - top - pad * 3) / 2;

  let b = panel(ctx, pad, top, colW, rowH, 'Environmental · EFM');
  fieldChart(ctx, { ...b, h: b.h - 26 }, sim);

  b = panel(ctx, pad * 2 + colW, top, colW, rowH, 'Lightning strike map');
  strikeMap(ctx, b, sim);

  b = panel(ctx, pad * 3 + colW * 2, top, colW, rowH, 'Detection nodes');
  nodeHealth(ctx, { ...b, h: b.h * 0.5 }, sim);
  strikeList(ctx, { ...b, y: b.y + 108 }, sim);

  b = panel(ctx, pad, top + rowH + pad, colW * 2 + pad, rowH, 'Soldier monitoring');
  squadTable(ctx, b, sim);

  b = panel(ctx, pad * 3 + colW * 2, top + rowH + pad, colW, rowH, 'Alert log', C.amber);
  alertLog(ctx, b, sim);
}

export function drawEFM(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'EFM — ELECTRIC FIELD MONITOR', 'EFM-100C · kV/m');
  const b = panel(ctx, 14, 58, w - 28, h - 150, 'Field trend · last 90 s');
  fieldChart(ctx, { ...b, h: b.h - 24 }, sim, { big: true });
  const b2 = panel(ctx, 14, h - 84, w - 28, 70, null);
  const lvl = sim.level;
  pill(ctx, b2.x, b2.y + 6, `STATE · ${lvl}`, LEVEL_COLOR[lvl], true);
  label(ctx, b2.x + 150, b2.y + 22, 'Thresholds are operator-configurable parameters and are not set in this demonstration.', C.dim, 11);
}

export function drawLightning(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'LDS — LIGHTNING DETECTION NETWORK', `${sim.nodes.length} nodes · synthetic strikes`);
  const half = (w - 42) / 2;
  let b = panel(ctx, 14, 58, half, h - 72, 'Live map · monitoring rings');
  strikeMap(ctx, b, sim);
  b = panel(ctx, 28 + half, 58, half, (h - 86) / 2, 'Node health');
  nodeHealth(ctx, b, sim);
  b = panel(ctx, 28 + half, 72 + (h - 86) / 2, half, (h - 86) / 2, 'Recent strikes');
  strikeList(ctx, b, sim);
}

export function drawSquad(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'SOLDIER HEALTH & TROOP MONITORING', 'Anonymised identifiers');
  const b = panel(ctx, 14, 58, w - 28, h - 72, 'Squad status');
  squadTable(ctx, b, sim);
}

export function drawWarning(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'EARLY WARNING SYSTEM', 'Light · sound · digital notification');
  const half = (w - 42) / 2;
  let b = panel(ctx, 14, 58, half, h - 72, 'Alert state');
  stateLadder(ctx, b, sim);
  b = panel(ctx, 28 + half, 58, half, h - 72, 'Annunciation', C.amber);
  const items = [
    ['LED beacon', sim.level !== 'NORMAL'],
    ['Sounder', sim.level === 'ALERT'],
    ['Local display', true],
    ['Commander notification', sim.level === 'ALERT'],
  ];
  items.forEach(([name, on], i) => {
    const yy = b.y + 20 + i * 34;
    ctx.fillStyle = on ? LEVEL_COLOR[sim.level] : C.line;
    rr(ctx, b.x, yy - 12, 34, 18, 9); ctx.fill();
    ctx.fillStyle = '#04070b';
    ctx.beginPath(); ctx.arc(b.x + (on ? 25 : 9), yy - 3, 6, 0, Math.PI * 2); ctx.fill();
    label(ctx, b.x + 46, yy, name, C.text, 12, 600);
    label(ctx, b.x + 240, yy, on ? 'ACTIVE' : 'STANDBY', on ? LEVEL_COLOR[sim.level] : C.dim, 11, 700);
  });
  label(ctx, b.x, b.y + b.h - 8, 'Placeholder hardware — final alert equipment not supplied', C.dim, 10);
}

export function drawTranslator(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'TRANSLATOR', 'Hindi ↔ Chinese');
  const half = (h - 74) / 2;
  const exchanges = [
    { from: 'हिन्दी', to: '中文', a: 'नमस्ते। यह एक निर्धारित बैठक है।', b: '你好。这是一次预定的会晤。' },
    { from: '中文', to: 'हिन्दी', a: '我们收到通知了。', b: 'हमें सूचना मिल गई है।' },
  ];
  exchanges.forEach((ex, i) => {
    const b = panel(ctx, 14, 58 + i * (half + 10), w - 28, half - 4,
      `${ex.from} → ${ex.to}`, i === 0 ? C.cyan : C.violet);
    ctx.fillStyle = C.text;
    ctx.font = '600 17px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ex.a, b.x, b.y + 26);
    ctx.fillStyle = C.dim;
    ctx.fillRect(b.x, b.y + 40, b.w, 1);
    ctx.fillStyle = i === 0 ? C.cyan : C.violet;
    ctx.font = '700 19px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(ex.b, b.x, b.y + 72);
  });
  label(ctx, 18, h - 10, 'Workflow illustration · voice and offline modes are not claimed', C.dim, 10);
}

export function drawDetections(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'BORDER SENSORS · OBJECT DETECTION', 'Perimeter RX/TX posts');
  const b = panel(ctx, 14, 58, w - 28, h - 72, 'Active detections');
  label(ctx, b.x, b.y + 2, 'ID          CLASS       CONF    ZONE           AGE', C.dim, 10, 600);
  sim.detections.forEach((d, i) => {
    const yy = b.y + 26 + i * 30;
    const col = d.inZone ? C.red : C.green;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent';
    ctx.fillRect(b.x - 6, yy - 14, b.w + 12, 26);
    label(ctx, b.x, yy, d.id, C.text, 12, 600);
    label(ctx, b.x + 86, yy, d.kind.toUpperCase(), col, 12, 600);
    mono(ctx, b.x + 186, yy, `${(d.confidence * 100).toFixed(0)}%`, C.dim, 11);
    label(ctx, b.x + 250, yy, d.inZone ? 'RESTRICTED' : 'OUTSIDE', col, 11, 600);
    mono(ctx, b.x + 380, yy, `${d.age.toFixed(0)}s`, C.dim, 11);
  });
  label(ctx, b.x, b.y + b.h - 6, 'Demonstration overlays · detection range and confidence not asserted', C.dim, 10);
}

export function drawDrone(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'DRONE TRACKING · GROUND STATION', 'Track state');
  const b = panel(ctx, 14, 58, w - 28, h - 72, 'Track TRK-01');
  const t = sim.time;
  const rows = [
    ['Bearing', `${((t * 6) % 360).toFixed(0)}°`],
    ['Range', `${(1.4 + Math.sin(t * 0.3) * 0.4).toFixed(2)} km`],
    ['Altitude', `${(200 + Math.sin(t * 0.5) * 18).toFixed(0)} m AGL`],
    ['Station', 'Dish 01 · locked'],
    ['Zone', 'Outside restricted boundary'],
  ];
  rows.forEach(([k, v], i) => {
    const yy = b.y + 24 + i * 32;
    label(ctx, b.x, yy, k, C.dim, 12);
    mono(ctx, b.x + 200, yy, v, C.text, 14);
  });
}

export function drawSatellite(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'SATELLITE TRACKING & FOOTPRINT', 'Illustrative');
  const b = panel(ctx, 14, 58, w - 28, h - 72, 'Space segment');
  ['SAT-A', 'SAT-B', 'SAT-C'].forEach((id, i) => {
    const yy = b.y + 26 + i * 34;
    ctx.fillStyle = i === 1 ? C.cyan : C.dim;
    ctx.beginPath(); ctx.arc(b.x + 5, yy - 4, 4.5, 0, Math.PI * 2); ctx.fill();
    label(ctx, b.x + 18, yy, id, C.text, 12, 600);
    label(ctx, b.x + 96, yy, i === 1 ? 'FOOTPRINT ACTIVE' : 'IN VIEW', i === 1 ? C.cyan : C.dim, 11, 600);
    mono(ctx, b.x + 260, yy, `link ${i === 1 ? 'PRIMARY' : 'STANDBY'}`, C.dim, 11);
  });
  label(ctx, b.x, b.y + b.h - 6, 'No ephemeris or real coverage computation is used', C.dim, 10);
}

export function drawAirbase(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'SITE & FORCE PROTECTION', 'Fictional installation');
  const b = panel(ctx, 14, 58, w - 28, h - 72, 'Protection status');
  const rows = [
    ['Perimeter posts', `6 / 6 reporting`],
    ['Restricted zone', sim.detections.some((d) => d.inZone) ? 'BREACH DETECTED' : 'CLEAR'],
    ['Environmental', sim.level],
    ['Air picture', '1 track · 2 rotary'],
  ];
  rows.forEach(([k, v], i) => {
    const yy = b.y + 24 + i * 32;
    label(ctx, b.x, yy, k, C.dim, 12);
    const col = v.includes('BREACH') || v === 'ALERT' ? C.red : v === 'CAUTION' ? C.amber : C.text;
    mono(ctx, b.x + 220, yy, v, col, 13);
  });
}

export function drawConsole(ctx, w, h, sim) {
  background(ctx, w, h);
  header(ctx, w, sim, 'SYSTEM STATUS', 'Node · network · service');
  const b = panel(ctx, 12, 54, w - 24, h - 68, null);
  const services = [
    ['Sensor gateway', true], ['Strike processing', true], ['Telemetry service', true],
    ['Notification service', false], ['Translator service', true],
  ];
  services.forEach(([name, ok], i) => {
    const yy = b.y + 22 + i * 30;
    ctx.fillStyle = ok ? C.green : C.amber;
    ctx.beginPath(); ctx.arc(b.x + 6, yy - 4, 4.5, 0, Math.PI * 2); ctx.fill();
    label(ctx, b.x + 20, yy, name, C.text, 12, 600);
    label(ctx, b.x + w * 0.55, yy, ok ? 'RUNNING' : 'NOT CONNECTED', ok ? C.green : C.amber, 11, 700);
  });
}

/** Round watch face for the wearable. */
export function drawWatch(ctx, w, h, sim, index = 0) {
  const s = sim.squad[index % sim.squad.length];
  ctx.fillStyle = '#05080d';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  ctx.strokeStyle = LEVEL_COLOR[sim.level];
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.6); ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = C.dim;
  ctx.font = '600 20px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(s.id, cx, cy - h * 0.22);
  ctx.fillStyle = C.text;
  ctx.font = '700 62px ui-monospace, Menlo, monospace';
  ctx.fillText(s.hr.toFixed(0), cx, cy + 16);
  ctx.fillStyle = C.dim;
  ctx.font = '600 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText('bpm*', cx, cy + 42);
  ctx.fillStyle = s.link ? C.green : C.red;
  ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(s.link ? 'LINK OK' : 'NO LINK', cx, cy + h * 0.3);
  ctx.fillStyle = C.dim;
  ctx.font = '600 16px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`${s.battery.toFixed(0)}%`, cx, cy + h * 0.39);
}

export const DASHBOARDS = {
  command: drawCommand,
  efm: drawEFM,
  lightning: drawLightning,
  squad: drawSquad,
  warning: drawWarning,
  translator: drawTranslator,
  detections: drawDetections,
  drone: drawDrone,
  satellite: drawSatellite,
  airbase: drawAirbase,
  console: drawConsole,
  watch: drawWatch,
};

export function renderDashboard(kind, ctx, w, h, sim, extra) {
  const fn = DASHBOARDS[kind] || drawConsole;
  ctx.save();
  fn(ctx, w, h, sim, extra);
  ctx.restore();
}

/** Owns every canvas used as an in-scene screen texture. */
export class ScreenSet {
  constructor(sim) {
    this.sim = sim;
    this.items = [];
    this.canvases = {};
    const make = (key, kind, w, h, hz = 4) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      this.items.push({ kind, ctx, w, h, hz, acc: 0, canvas: cv });
      this.canvases[key] = cv;
      return cv;
    };
    make('command', 'command', 1600, 800, 4);
    make('efm', 'efm', 1024, 600, 6);
    make('console', 'console', 1024, 600, 2);
    make('translator', 'translator', 640, 1000, 2);
    make('watch', 'watch', 320, 320, 4);
    make('handheld', 'squad', 640, 1000, 3);
  }

  update(dt) {
    for (const it of this.items) {
      it.acc += dt;
      if (it.acc < 1 / it.hz) continue;
      it.acc = 0;
      renderDashboard(it.kind, it.ctx, it.w, it.h, this.sim, 0);
      if (it.texture) it.texture.needsUpdate = true;
    }
  }

  /** Bind a material created from one of these canvases so it refreshes. */
  bind(key, material) {
    const it = this.items.find((i) => this.canvases[key] === i.canvas);
    if (it && material?.userData?.texture) it.texture = material.userData.texture;
  }
}
