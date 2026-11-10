// Drawing helpers shared by all modes: HUD widgets and a few common world-space effects.

import { TAU, clamp } from './util.js';

export function hearts(g, current, max, y = 32) {
  g.font = '22px system-ui';
  g.textAlign = 'left';
  for (let i = 0; i < max; i++) {
    g.fillStyle = i < current ? '#ff4d6d' : '#ffffff44';
    g.fillText('♥', 14 + i * 26, y);
  }
}

/** Level title with the thin yellow progress bar underneath. */
export function titleBar(g, view, title, progress, { color = '#fff', y = 22, showProgress = true } = {}) {
  g.font = '700 14px system-ui';
  g.textAlign = 'center';
  g.fillStyle = color;
  g.fillText(title, view.w / 2, y);
  if (!showProgress) return;
  g.fillStyle = '#0005';
  g.fillRect(view.w / 2 - 100, y + 8, 200, 5);
  g.fillStyle = '#ffd43b';
  g.fillRect(view.w / 2 - 100, y + 8, 200 * clamp(progress, 0, 1), 5);
}

/** Text in a dark pill at the bottom of the screen (level tips, warnings). */
export function banner(g, view, text, color = '#fff') {
  g.font = '700 13px system-ui';
  g.textAlign = 'center';
  const w = g.measureText(text).width + 24;
  g.fillStyle = '#000a';
  g.fillRect(view.w / 2 - w / 2, view.h - 44, w, 28);
  g.fillStyle = color;
  g.fillText(text, view.w / 2, view.h - 25);
}

/** Big outlined centre text that fades out (power-ups, speed-ups...). */
export function callout(g, view, text, timeLeft, color, y = 104) {
  if (timeLeft <= 0) return;
  g.save();
  g.globalAlpha = Math.min(1, timeLeft * 2);
  g.textAlign = 'center';
  g.font = '800 20px system-ui';
  g.lineWidth = 4;
  g.strokeStyle = '#0008';
  g.strokeText(text, view.w / 2, y);
  g.fillStyle = color;
  g.fillText(text, view.w / 2, y);
  g.restore();
}

/** Horizontal meter with a label icon. Returns nothing; colours are chosen by the caller. */
export function meter(g, x, y, w, h, fraction, fill, { label = '', labelX = 14, border = '#fff6' } = {}) {
  if (label) {
    g.textAlign = 'left';
    g.fillStyle = '#fff';
    g.fillText(label, labelX, y + h - 1);
  }
  g.fillStyle = '#0008';
  g.fillRect(x, y, w, h);
  g.fillStyle = fill;
  g.fillRect(x, y, w * clamp(fraction, 0, 1), h);
  g.strokeStyle = border;
  g.strokeRect(x, y, w, h);
}

/** Fuel colour: green, or flashing red when low. */
export const fuelColor = (fraction, t) => fraction < 0.25 ? (Math.floor(t * 6) % 2 ? '#ff3b3b' : '#a51111') : '#51cf66';

/**
 * Flashing ▼ at the top of the screen plus a dashed drop line: "something is about to fall here".
 * Drawn in world space; `rgb` is a "r,g,b" string.
 */
export function dropWarning(g, x, t, viewH, rgb, half = 9) {
  g.fillStyle = `rgba(${rgb},${0.5 + Math.sin(t * 22) * 0.4})`;
  g.beginPath();
  g.moveTo(x, 40);
  g.lineTo(x - half, 22);
  g.lineTo(x + half, 22);
  g.fill();
  g.strokeStyle = `rgba(${rgb},.25)`;
  g.lineWidth = 1;
  g.setLineDash([3, 7]);
  g.beginPath();
  g.moveTo(x, 44);
  g.lineTo(x, viewH);
  g.stroke();
  g.setLineDash([]);
}

/** Soft radial glow (additive look without changing the composite mode). */
export function glow(g, x, y, r, color, inner = 0) {
  const gr = g.createRadialGradient(x, y, inner, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, '#0000');
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

export function circle(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

export function ellipse(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fill();
}

export function poly(g, ...pts) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.fill();
}

export function line(g, ...pts) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.stroke();
}

export function verticalGradient(g, h, stops) {
  const gr = g.createLinearGradient(0, 0, 0, h);
  stops.forEach(([at, c]) => gr.addColorStop(at, c));
  return gr;
}

/** Fills the whole view with a vertical gradient (sky backgrounds). */
export function sky(g, view, stops) {
  g.fillStyle = verticalGradient(g, view.h, stops);
  g.fillRect(0, 0, view.w, view.h);
}
