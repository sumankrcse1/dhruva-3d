// Screen-space callouts anchored to world positions, with SVG leader lines —
// the labelled-diagram treatment from the reference composition.

import * as THREE from 'three';

const NS = 'http://www.w3.org/2000/svg';

export class CalloutLayer {
  constructor(layerEl, svgEl) {
    this.layer = layerEl;
    this.svg = svgEl;
    this.items = [];
    this.visible = true;
    this._v = new THREE.Vector3();
  }

  add(spec) {
    const el = document.createElement('button');
    el.className = `callout${spec.kind ? ` callout--${spec.kind}` : ''}`;
    el.type = 'button';
    el.innerHTML = `<span class="callout__title">${spec.title}</span>` +
      (spec.sub ? `<span class="callout__sub">${spec.sub}</span>` : '');
    el.dataset.system = spec.system || '';
    if (spec.system) {
      el.addEventListener('click', () => spec.onSelect?.(spec.system));
    } else {
      el.classList.add('callout--static');
    }
    this.layer.appendChild(el);

    const line = document.createElementNS(NS, 'path');
    line.setAttribute('class', `leader${spec.kind ? ` leader--${spec.kind}` : ''}`);
    this.svg.appendChild(line);

    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('class', `leader-dot${spec.kind ? ` leader-dot--${spec.kind}` : ''}`);
    dot.setAttribute('r', '4');
    this.svg.appendChild(dot);

    const item = {
      ...spec,
      el, line, dot,
      offset: spec.offset || [0, -90],
      position: spec.position.clone(),
    };
    this.items.push(item);
    return item;
  }

  setVisible(v) {
    this.visible = v;
    this.layer.style.display = v ? '' : 'none';
    this.svg.style.display = v ? '' : 'none';
  }

  /** Emphasise one subsystem; pass null to clear. */
  setFocus(systemId) {
    this.focus = systemId;
    for (const it of this.items) {
      const on = !systemId || it.system === systemId;
      it.el.classList.toggle('is-muted', !on);
      it.line.classList.toggle('is-muted', !on);
      it.dot.classList.toggle('is-muted', !on);
    }
  }

  update(camera, width, height) {
    if (!this.visible) return;
    const camPos = camera.position;
    const placed = [];
    for (const it of this.items) {
      this._v.copy(it.position).project(camera);
      const behind = this._v.z > 1;
      const sx = (this._v.x * 0.5 + 0.5) * width;
      const sy = (-this._v.y * 0.5 + 0.5) * height;
      const dist = camPos.distanceTo(it.position);

      const near = it.minDistance ?? 0;
      const far = it.maxDistance ?? 3200;
      const onScreen = !behind && sx > -180 && sx < width + 180 && sy > -120 && sy < height + 120;
      const show = onScreen && dist > near && dist < far;

      if (!show) {
        it.el.style.opacity = '0';
        it.el.style.pointerEvents = 'none';
        it.line.style.opacity = '0';
        it.dot.style.opacity = '0';
        continue;
      }

      // Fade as the anchor approaches the edges of the visible range.
      const fade = Math.min(1, (dist - near) / Math.max(1, far * 0.12)) *
        Math.min(1, (far - dist) / Math.max(1, far * 0.25));
      const opacity = Math.max(0, Math.min(1, fade));

      const [dx, dy] = it.offset;
      // Keep callouts inside the viewport, clear of the rail and the legend.
      const leftBound = width > 720 ? 336 : 10;
      const rightBound = width - (this.panelOpen && width > 720 ? 440 : 250);
      const lx = Math.max(leftBound, Math.min(rightBound, sx + dx));
      let ly = Math.max(70, Math.min(height - 190, sy + dy));

      // Push apart labels that would otherwise stack on each other.
      const w0 = it.el.offsetWidth || 180;
      const h0 = it.el.offsetHeight || 40;
      for (let pass = 0; pass < 12; pass++) {
        let moved = false;
        for (const p of placed) {
          if (lx > p.x + p.w + 8 || lx + w0 + 8 < p.x) continue;
          if (ly > p.y + p.h + 6 || ly + h0 + 6 < p.y) continue;
          ly = p.y + p.h + 8;
          moved = true;
        }
        if (!moved) break;
      }
      ly = Math.min(ly, height - 190);
      placed.push({ x: lx, y: ly, w: w0, h: h0 });

      it.el.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
      it.el.style.opacity = String(opacity);
      it.el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none';

      const w = it.el.offsetWidth || 180;
      const h = it.el.offsetHeight || 40;
      // Anchor the leader to whichever edge of the label faces the target.
      const ax = sx > lx + w ? lx + w : sx < lx ? lx : lx + w / 2;
      const ay = sy > ly + h ? ly + h : sy < ly ? ly : ly + h / 2;
      const midX = (ax + sx) / 2;
      it.line.setAttribute('d', `M ${ax} ${ay} L ${midX} ${(ay + sy) / 2} L ${sx} ${sy}`);
      it.line.style.opacity = String(opacity * 0.9);
      it.dot.setAttribute('cx', sx);
      it.dot.setAttribute('cy', sy);
      it.dot.style.opacity = String(opacity);
    }
  }
}
