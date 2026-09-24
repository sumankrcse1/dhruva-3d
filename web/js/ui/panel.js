// Subsystem detail panel: the sensor -> action chain, reference figures, the
// live dashboard for that subsystem, and what is explicitly not asserted.

import { SYSTEM_BY_ID } from '../data/systems.js';
import { renderDashboard } from './screens.js';
import { icon } from './icons.js';

export class DetailPanel {
  constructor(el, sim, handlers = {}) {
    this.el = el;
    this.sim = sim;
    this.handlers = handlers;
    this.system = null;
    this.acc = 0;

    this.el.innerHTML = `
      <header class="panel__head">
        <span class="panel__icon" data-role="icon"></span>
        <div class="panel__titles">
          <h2 data-role="title"></h2>
          <p data-role="caption"></p>
        </div>
        <button class="panel__close" type="button" aria-label="Close">&times;</button>
      </header>
      <div class="panel__body">
        <p class="panel__summary" data-role="summary"></p>
        <div class="panel__actions">
          <button type="button" data-action="focus">Fly to</button>
          <button type="button" data-action="isolate">Isolate zone</button>
          <button type="button" data-action="links">Trace data path</button>
        </div>
        <section class="panel__block">
          <h3>Live view</h3>
          <canvas data-role="dash"></canvas>
        </section>
        <section class="panel__block">
          <h3>Sensor → action chain</h3>
          <ol class="chain" data-role="chain"></ol>
        </section>
        <section class="panel__block">
          <h3>Reference figures</h3>
          <dl class="specs" data-role="specs"></dl>
        </section>
        <section class="panel__block panel__block--note">
          <h3>Not asserted</h3>
          <p data-role="notes"></p>
        </section>
        <p class="panel__zone" data-role="zone"></p>
      </div>`;

    this.refs = {
      icon: this.el.querySelector('[data-role="icon"]'),
      title: this.el.querySelector('[data-role="title"]'),
      caption: this.el.querySelector('[data-role="caption"]'),
      summary: this.el.querySelector('[data-role="summary"]'),
      chain: this.el.querySelector('[data-role="chain"]'),
      specs: this.el.querySelector('[data-role="specs"]'),
      notes: this.el.querySelector('[data-role="notes"]'),
      zone: this.el.querySelector('[data-role="zone"]'),
      canvas: this.el.querySelector('[data-role="dash"]'),
    };
    this.ctx = this.refs.canvas.getContext('2d');

    this.el.querySelector('.panel__close').addEventListener('click', () => this.close());
    this.el.querySelector('[data-action="focus"]').addEventListener('click',
      () => this.system && this.handlers.onFocus?.(this.system.id));
    this.el.querySelector('[data-action="isolate"]').addEventListener('click',
      (e) => {
        if (!this.system) return;
        const on = e.currentTarget.classList.toggle('is-active');
        this.handlers.onIsolate?.(on ? this.system.id : null);
      });
    this.el.querySelector('[data-action="links"]').addEventListener('click',
      (e) => {
        const on = e.currentTarget.classList.toggle('is-active');
        this.handlers.onTrace?.(on ? this.system?.id : null);
      });
  }

  open(systemId) {
    const sys = SYSTEM_BY_ID[systemId];
    if (!sys) return;
    this.system = sys;
    this.refs.icon.innerHTML = icon(sys.icon);
    this.refs.title.textContent = sys.name;
    this.refs.caption.textContent = sys.caption;
    this.refs.summary.textContent = sys.summary;
    this.refs.notes.textContent = sys.notes;
    this.refs.zone.textContent = `Blender collection: ${sys.zone}`;

    this.refs.chain.innerHTML = sys.chain
      .map(([step, detail]) => `<li><span class="chain__step">${step}</span><span class="chain__detail">${detail}</span></li>`)
      .join('');
    this.refs.specs.innerHTML = sys.specs
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

    this.el.classList.add('is-open');
    this.resizeCanvas();
    this.draw();
  }

  close() {
    this.el.classList.remove('is-open');
    this.system = null;
    this.handlers.onClose?.();
  }

  get isOpen() { return this.el.classList.contains('is-open'); }

  // The dashboards are authored against a fixed logical canvas so type and
  // spacing stay proportional however wide the panel is.
  static LOGICAL_W = 760;
  static LOGICAL_H = 470;

  resizeCanvas() {
    const cv = this.refs.canvas;
    const w = cv.clientWidth || 340;
    const h = Math.round((w * DetailPanel.LOGICAL_H) / DetailPanel.LOGICAL_W);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.height = `${h}px`;
    const k = (w / DetailPanel.LOGICAL_W) * dpr;
    this.ctx.setTransform(k, 0, 0, k, 0, 0);
  }

  draw() {
    if (!this.system) return;
    renderDashboard(this.system.dashboard, this.ctx,
      DetailPanel.LOGICAL_W, DetailPanel.LOGICAL_H, this.sim, 0);
  }

  update(dt) {
    if (!this.isOpen) return;
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;
    this.draw();
  }
}
