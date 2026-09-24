// Screen furniture: legend strip, chapter rail, control cluster, status line.

import { SYSTEMS, SYSTEM_BY_ID, LEGEND_ORDER, CHAPTERS } from '../data/systems.js';
import { icon } from './icons.js';

export class Hud {
  constructor(app) {
    this.app = app;
    this.sim = app.sim;
    this.el = {
      legend: document.getElementById('legend'),
      chapters: document.getElementById('chapters'),
      chapterText: document.getElementById('chapter-text'),
      chapterTitle: document.getElementById('chapter-title'),
      state: document.getElementById('state-pill'),
      clock: document.getElementById('hud-clock'),
      ticker: document.getElementById('ticker'),
      linkClasses: document.getElementById('link-classes'),
      scaleNote: document.getElementById('scale-note'),
    };
    this.buildLegend();
    this.buildChapters();
    this.buildLinkClasses();
    this.bindControls();
    this.activeSystem = null;
    this.lastEventCount = 0;
  }

  buildLegend() {
    this.el.legend.innerHTML = LEGEND_ORDER.map((id) => {
      const s = SYSTEM_BY_ID[id];
      return `<button class="legend__item" type="button" data-system="${id}" title="${s.name}">
        <span class="legend__icon">${icon(s.icon)}</span>
        <span class="legend__label">${s.short}</span>
        <span class="legend__sub">${s.caption}</span>
      </button>`;
    }).join('');
    this.el.legend.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-system]');
      if (btn) this.app.selectSystem(btn.dataset.system);
    });
  }

  buildChapters() {
    this.el.chapters.innerHTML = CHAPTERS.map((c, i) =>
      `<button class="chapter" type="button" data-index="${i}">
        <span class="chapter__frame">${c.frame}</span>
        <span class="chapter__title">${c.title}</span>
      </button>`).join('');
    this.el.chapters.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-index]');
      if (btn) this.app.goToChapter(Number(btn.dataset.index));
    });
  }

  buildLinkClasses() {
    const classes = this.app.links.classes;
    this.el.linkClasses.innerHTML = Object.entries(classes).map(([key, c]) =>
      `<label class="swatch"><input type="checkbox" data-link="${key}" checked>
        <span class="swatch__dot" style="--c:#${c.color.toString(16).padStart(6, '0')}"></span>
        <span>${c.label}</span></label>`).join('');
    this.el.linkClasses.addEventListener('change', (e) => {
      const input = e.target.closest('[data-link]');
      if (input) this.app.links.setClassVisible(input.dataset.link, input.checked);
    });
  }

  bindControls() {
    const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

    on('btn-play', 'click', () => this.app.togglePresentation());
    on('btn-prev', 'click', () => this.app.goToChapter(this.app.chapterIndex - 1));
    on('btn-next', 'click', () => this.app.goToChapter(this.app.chapterIndex + 1));
    on('btn-reset', 'click', () => this.app.setView('master'));

    document.querySelectorAll('[data-level]').forEach((b) => {
      b.addEventListener('click', () => {
        const lvl = b.dataset.level;
        if (lvl === 'AUTO') this.sim.runSequence(true);
        else this.sim.setLevel(lvl);
        this.syncLevelButtons();
      });
    });

    on('tgl-labels', 'change', (e) => this.app.callouts.setVisible(e.target.checked));
    on('tgl-links', 'change', (e) => this.app.links.setVisible(e.target.checked));
    on('tgl-night', 'change', (e) => this.app.setNight(e.target.checked));
    on('tgl-scale', 'change', (e) => this.app.setExhibitionScale(e.target.checked));
    on('tgl-rotate', 'change', (e) => { this.app.controls.autoRotate = e.target.checked; });
    on('sel-quality', 'change', (e) => this.app.setQuality(e.target.value));
    on('btn-help', 'click', () => document.getElementById('intro').classList.add('is-open'));
    document.querySelectorAll('[data-dismiss="intro"]').forEach((b) =>
      b.addEventListener('click', () => document.getElementById('intro').classList.remove('is-open')));
    on('btn-fullscreen', 'click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    });
  }

  syncLevelButtons() {
    document.querySelectorAll('[data-level]').forEach((b) => {
      const isAuto = b.dataset.level === 'AUTO';
      b.classList.toggle('is-active', isAuto ? this.sim.autoSequence : (!this.sim.autoSequence && this.sim.level === b.dataset.level));
    });
  }

  setActiveSystem(id) {
    this.activeSystem = id;
    this.el.legend.querySelectorAll('[data-system]').forEach((b) =>
      b.classList.toggle('is-active', b.dataset.system === id));
  }

  setChapter(index) {
    const c = CHAPTERS[index];
    this.el.chapters.querySelectorAll('.chapter').forEach((b, i) =>
      b.classList.toggle('is-active', i === index));
    if (c) {
      this.el.chapterTitle.textContent = `${c.frame} · ${c.title}`;
      this.el.chapterText.textContent = c.text;
    }
  }

  setPlaying(playing) {
    const btn = document.getElementById('btn-play');
    if (btn) {
      btn.classList.toggle('is-active', playing);
      btn.querySelector('span').textContent = playing ? 'Pause tour' : 'Play tour';
    }
  }

  setScaleNote(exhibition) {
    this.el.scaleNote.textContent = exhibition
      ? 'Hero hardware shown at exhibition scale for legibility'
      : 'Hero hardware shown at true scale (EFM sensor is 170 mm)';
    this.el.scaleNote.classList.toggle('is-true-scale', !exhibition);
  }

  update() {
    const lvl = this.sim.level;
    this.el.state.textContent = lvl;
    this.el.state.dataset.level = lvl;
    this.el.clock.textContent = this.sim.clock();
    if (this.sim.events.length !== this.lastEventCount) {
      this.lastEventCount = this.sim.events.length;
      const e = this.sim.events[0];
      this.el.ticker.innerHTML =
        `<span class="ticker__src ticker__src--${e.level}">${e.source}</span> ${e.text}`;
      this.el.ticker.classList.remove('is-new');
      void this.el.ticker.offsetWidth;
      this.el.ticker.classList.add('is-new');
    }
    this.syncLevelButtons();
  }
}
