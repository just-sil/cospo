// Sprites shared by the platformer levels: the sheep, the classic wolf and the level furniture.
// Everything is drawn with canvas primitives in world coordinates (y grows downwards, feet at y).

import { TAU } from './core/util.js';
import { circle, ellipse, poly } from './core/hud.js';
import { GROUND_Y } from './entities.js';

/**
 * The hero. `headTilt` in [-1, 1] nods the head; `gear(g)` draws level equipment (gun, cape...)
 * in the sheep's local, facing-corrected space.
 */
export function drawSheep(g, p, t, { headTilt = 0, blink = false, gear = null } = {}) {
  const hv = headTilt * 6;
  g.save();
  g.translate(p.x, p.y);
  g.fillStyle = '#0004';
  ellipse(g, 0, 1, 13, 4);
  if (blink) g.globalAlpha = 0.4;
  g.scale(p.face, 1);
  g.scale(1 + p.squash, 1 - p.squash);

  // legs
  const running = Math.abs(p.vx) > 30 && p.grounded, airborne = !p.grounded;
  g.strokeStyle = '#2b2733';
  g.lineWidth = 4;
  g.lineCap = 'round';
  [-8, -2, 6, 12].forEach((x, i) => {
    const swing = running ? Math.sin(t * 16 + i * 1.6) * 6 : 0;
    g.beginPath();
    g.moveTo(x, -10);
    g.lineTo(x + swing + (airborne ? 3 : 0), airborne ? -5 : 0);
    g.stroke();
  });

  // fleece: shaded back layer, then the bright top layer
  g.fillStyle = '#e4e9f7';
  [[-8, -18, 9], [8, -18, 9], [0, -14, 9]].forEach(([x, y, r]) => circle(g, x, y, r));
  g.fillStyle = '#fff';
  [[-12, -24, 10], [-2, -30, 11], [9, -28, 10], [14, -21, 9], [-5, -20, 10], [4, -21, 10]].forEach(([x, y, r]) => circle(g, x, y, r));

  // head, ear, eye
  g.fillStyle = '#2f2938';
  ellipse(g, 17, -22 + hv, 7, 8, 0.2 + hv * 0.05);
  ellipse(g, 12, -26 + hv, 5, 3, -0.5);
  g.fillStyle = '#fff';
  g.fillRect(18, -26 + hv, 4, 4);
  g.fillStyle = '#000';
  g.fillRect(20, -25 + hv, 2, 2);

  gear?.(g);
  g.restore();
}

/** The basic grey wolf (red-eyed and darker at night). */
export function drawWolf(g, w, t, night) {
  const r = Math.sin(t * 12 + w.x) * 3;
  g.save();
  g.translate(w.x, w.y);
  g.scale(w.dir, 1);
  g.fillStyle = '#0004';
  ellipse(g, 0, 1, 15, 4);
  g.fillStyle = night ? '#2f3140' : '#6c7280';
  ellipse(g, 0, -14, 16, 10);
  ellipse(g, 14, -18, 9, 7);
  poly(g, 10, -23, 12, -32, 16, -23);
  g.fillRect(-10, -8, 4, 8 + r * 0.3);
  g.fillRect(8, -8, 4, 8 - r * 0.3);
  poly(g, -14, -16, -26, -12 + r, -14, -10);
  g.fillStyle = night ? '#ff3b3b' : '#ffd43b';
  g.fillRect(16, -20, 3, 3);
  g.restore();
}

/** The red barn at the end of every platformer level. */
export function drawBarn(g, x, night) {
  const y = GROUND_Y;
  g.fillStyle = night ? '#6b1e1e' : '#c92a2a';
  g.fillRect(x, y - 70, 70, 70);
  poly(g, x - 8, y - 70, x + 35, y - 106, x + 78, y - 70);
  g.fillStyle = '#fff';
  g.fillRect(x + 22, y - 40, 26, 40);
  g.strokeStyle = '#c92a2a';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x + 22, y - 40); g.lineTo(x + 48, y);
  g.moveTo(x + 48, y - 40); g.lineTo(x + 22, y);
  g.stroke();
  if (night) {
    const gl = g.createRadialGradient(x + 35, y - 40, 5, x + 35, y - 40, 110);
    gl.addColorStop(0, '#ffd43b88');
    gl.addColorStop(1, '#0000');
    g.fillStyle = gl;
    g.fillRect(x - 80, y - 150, 230, 200);
  }
}

export function drawCheckpoint(g, c) {
  g.fillStyle = '#ddd';
  g.fillRect(c.x, c.y - 50, 3, 50);
  g.fillStyle = c.reached ? '#ffd43b' : '#868e96';
  poly(g, c.x + 3, c.y - 50, c.x + 26, c.y - 42, c.x + 3, c.y - 34);
}

export function drawSpikes(g, s) {
  g.fillStyle = '#cfd4da';
  for (let x = s.x; x < s.x + s.w; x += 10) poly(g, x, s.y, x + 5, s.y - 15, x + 10, s.y);
}

/** Fire jet: a nozzle that sputters (state 1) and then blasts a tall flame (state 2). */
export function drawJet(g, j, t) {
  g.fillStyle = '#222';
  g.fillRect(j.x - 14, j.y - 4, 28, 6);
  if (j.state === 0) return;
  const h = j.state === 2 ? 100 : 22 + Math.sin(t * 30) * 4;
  const gr = g.createLinearGradient(0, j.y - h, 0, j.y);
  gr.addColorStop(0, '#ff3b0000');
  gr.addColorStop(0.5, '#ff8a2b');
  gr.addColorStop(1, '#ffe066');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(j.x - 13, j.y - 4);
  g.quadraticCurveTo(j.x - 6 + Math.sin(t * 20) * 4, j.y - h * 0.6, j.x, j.y - h);
  g.quadraticCurveTo(j.x + 6, j.y - h * 0.6, j.x + 13, j.y - 4);
  g.fill();
}

/** Orange halo around blasting jets, drawn additively on night levels. */
export function drawJetGlow(g, j) {
  if (j.state !== 2) return;
  const gl = g.createRadialGradient(j.x, j.y - 50, 0, j.x, j.y - 50, 120);
  gl.addColorStop(0, '#ff7a1a55');
  gl.addColorStop(1, '#0000');
  g.fillStyle = gl;
  g.fillRect(j.x - 120, j.y - 170, 240, 240);
}

export function drawClover(g, c, t, night) {
  const bob = Math.sin(t * 4 + c.x) * 3;
  g.fillStyle = night ? '#69db7c' : '#40c057';
  for (const [ox, oy] of [[0, -4], [4, 0], [0, 4], [-4, 0]]) {
    g.beginPath();
    g.arc(c.x + ox, c.y + bob + oy, 4, 0, TAU);
    g.fill();
  }
  g.fillStyle = '#fff8';
  g.fillRect(c.x - 1, c.y + bob - 1, 2, 2);
}
