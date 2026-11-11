// The game screen: a fixed 450-px-tall canvas whose width follows the window's aspect ratio
// (640–1120 px), touch controls, the overlay root, fullscreen and portrait-phone rotation.

import { clamp } from './util.js';

export const VIEW_HEIGHT = 450;
const MIN_WIDTH = 640, MAX_WIDTH = 1120;

const el = (tag, attrs = {}, text = '') => {
  const e = document.createElement(tag);
  Object.assign(e, attrs);
  if (text) e.textContent = text;
  return e;
};

export class Stage {
  constructor(parent = document.body) {
    this.root = el('div', { id: 'stage' });
    this.canvas = el('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.view = { w: 800, h: VIEW_HEIGHT };
    this.canvas.width = this.view.w;
    this.canvas.height = this.view.h;

    // Touch controls (hidden on mouse/keyboard devices until the screen is touched).
    this.stick = el('div', { className: 'touch stick' });
    this.knob = el('div', { className: 'knob' });
    this.stick.append(this.knob);
    this.buttons = {
      jump: el('button', { className: 'touch tb jump', type: 'button' }, 'JUMP'),
      fire: el('button', { className: 'touch tb fire', type: 'button' }, 'FIRE'),
      nitro: el('button', { className: 'touch tb nitro', type: 'button' }, 'NITRO'),
      mute: el('button', { className: 'tb corner mute', type: 'button', title: 'Sound on/off' }, '🔊'),
      fullscreen: el('button', { className: 'tb corner fs', type: 'button', title: 'Fullscreen' }, '⛶'),
    };
    this.overlay = el('div', { className: 'overlay' });

    this.root.append(this.canvas, this.stick, ...Object.values(this.buttons), this.overlay);
    parent.append(this.root);

    const touchQuery = matchMedia('(any-pointer: coarse)');
    this.setTouch(touchQuery.matches);
    addEventListener('touchstart', () => this.setTouch(true), { once: true, passive: true });

    this.buttons.fullscreen.addEventListener('click', () => this.toggleFullscreen());
    const relayout = () => this.layout();
    addEventListener('resize', relayout);
    addEventListener('orientationchange', () => setTimeout(relayout, 250));
    addEventListener('adlayout', relayout); // the ad banner appeared/disappeared
    document.addEventListener('fullscreenchange', () => setTimeout(relayout, 150));
    this.layout();
  }

  get rotated() { return document.body.classList.contains('rot'); }

  setTouch(on) { document.body.classList.toggle('touch-ui', on); }

  /** Which mode-specific buttons are visible: { jump, fire, nitro }. */
  showControls({ jump = true, fire = false, nitro = false } = {}) {
    this.buttons.jump.hidden = !jump;
    this.buttons.fire.hidden = !fire;
    this.buttons.nitro.hidden = !nitro;
  }

  layout() {
    const iw = innerWidth, ih = innerHeight;
    // Portrait phones: rotate the whole stage so the game is always played in landscape.
    const rotate = ih > iw && matchMedia('(pointer: coarse)').matches;
    document.body.classList.toggle('rot', rotate);
    const banner = globalThis.AD?.bannerHeight?.() || 0;
    const w = rotate ? ih - banner : iw, h = rotate ? iw : ih - banner;
    Object.assign(this.root.style, { width: w + 'px', height: h + 'px', left: rotate ? iw + 'px' : '0', top: banner + 'px' });
    const width = clamp(Math.round(VIEW_HEIGHT * w / h), MIN_WIDTH, MAX_WIDTH);
    if (width !== this.view.w) {
      this.view.w = width;
      this.canvas.width = width;
    }
  }

  toggleFullscreen() {
    const d = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      try { screen.orientation.unlock(); } catch { /* not supported */ }
      return;
    }
    const request = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!request) return;
    // Fullscreen or the orientation lock may be refused (iOS, desktop): keep playing windowed.
    new Promise(ok => ok(request.call(d)))
      .then(() => screen.orientation?.lock?.('landscape'))
      .catch(() => {});
  }
}
