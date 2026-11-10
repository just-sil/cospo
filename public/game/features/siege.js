// Siege of Ashkar: archers shoot aimed arrows, and volleys of three arrows rain from the sky.

import { clamp } from '../core/util.js';
import { circle, dropWarning, ellipse } from '../core/hud.js';

export class Siege {
  constructor(game) {
    this.game = game;
    this.archers = (game.level.world.archers || []).map(([x, y, phase]) => ({ x, y, cooldown: phase + 1, dir: -1 }));
    this.arrows = [];
    this.volley = [];
    this.volleyTimer = 3;
  }

  /** Arrows break on platforms they fly into. */
  hitsPlatform(x, y, depth) {
    return this.game.platforms.some(pl => !pl.fallen && x > pl.x && x < pl.x + pl.w && y > pl.y && y < pl.y + depth);
  }

  update(dt) {
    const game = this.game, p = game.player;

    for (const a of this.archers) {
      a.cooldown -= dt;
      a.dir = p.x >= a.x ? 1 : -1;
      if (a.cooldown > 0) continue;
      if (Math.abs(p.x - a.x) < 560 && game.onScreen(a.x, 20)) {
        a.cooldown = 2.4;
        const ax = a.x + a.dir * 16, ay = a.y - 24, angle = Math.atan2(p.y - 18 - ay, p.x - ax);
        this.arrows.push({ x: ax, y: ay, vx: Math.cos(angle) * 320, vy: Math.sin(angle) * 320, life: 3, angle });
        game.audio.play('arrow');
      } else a.cooldown = 0.4;
    }
    this.arrows = this.arrows.filter(a => {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.life -= dt;
      if (Math.hypot(a.x - p.x, a.y - (p.y - 16)) < 14) { game.hurt(); game.burst(a.x, a.y, 8, '#d9c7a0', 90); return false; }
      if (this.hitsPlatform(a.x, a.y, 14)) { game.burst(a.x, a.y, 5, '#caa46a', 60); return false; }
      return a.life > 0;
    });

    this.volleyTimer -= dt;
    if (this.volleyTimer <= 0 && p.x > 450) {
      this.volleyTimer = Math.max(2.6, 4.4 - game.time / 60);
      const centre = p.x + (game.rng() - 0.3) * 200;
      for (let i = -1; i <= 1; i++) this.volley.push({ x: clamp(centre + i * 75, 30, game.level.length), y: -30, warn: 0.9 });
    }
    this.volley = this.volley.filter(v => {
      if (v.warn > 0) { v.warn -= dt; return true; }
      v.y += 560 * dt;
      v.x -= 70 * dt;
      if (Math.hypot(v.x - p.x, v.y - (p.y - 14)) < 14) { game.hurt(); game.burst(v.x, v.y, 8, '#d9c7a0', 90); return false; }
      if (this.hitsPlatform(v.x, v.y, 16)) { game.burst(v.x, v.y, 5, '#caa46a', 60); return false; }
      return v.y < 540;
    });
  }

  drawWorld(g) {
    const game = this.game, t = game.t;
    for (const a of this.archers) {
      const drawing = a.cooldown < 0.5 && a.cooldown > 0 && Math.abs(game.player.x - a.x) < 560;
      g.save();
      g.translate(a.x, a.y);
      g.scale(a.dir, 1);
      g.fillStyle = '#0004';
      ellipse(g, 0, 1, 13, 4);
      g.fillStyle = '#3a2a1a';
      g.fillRect(-6, -10, 5, 10);
      g.fillRect(1, -10, 5, 10);
      g.fillStyle = '#4a5d3a';
      g.fillRect(-9, -28, 18, 18);
      g.fillStyle = '#e0b48a';
      circle(g, 0, -35, 7);
      g.fillStyle = '#4a5d3a';
      g.beginPath(); g.arc(0, -37, 8, Math.PI, 0); g.fill();
      g.fillStyle = '#222';
      g.fillRect(3, -36, 2, 2);
      // bow and string (pulled back while aiming)
      g.strokeStyle = '#6b4a2a';
      g.lineWidth = 3;
      g.beginPath(); g.arc(12, -23, 15, -1.2, 1.2); g.stroke();
      g.strokeStyle = '#eee';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(12 + 15 * Math.cos(-1.2), -23 + 15 * Math.sin(-1.2));
      g.lineTo(drawing ? 2 : 27, -23);
      g.lineTo(12 + 15 * Math.cos(1.2), -23 + 15 * Math.sin(1.2));
      g.stroke();
      if (drawing) {
        g.fillStyle = `rgba(255,80,60,${0.4 + Math.sin(t * 30) * 0.3})`;
        circle(g, 6, -23, 10);
        drawArrow(g, 6, -23, 0, 22);
      }
      g.restore();
    }
    for (const a of this.arrows) drawArrow(g, a.x, a.y, a.angle, 26);
    for (const v of this.volley) {
      if (v.warn > 0) dropWarning(g, v.x, t, game.view.h, '255,60,60', 8);
      else drawArrow(g, v.x, v.y, 1.69, 30);
    }
  }
}

function drawArrow(g, x, y, angle, length) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.strokeStyle = '#d9c7a0';
  g.lineWidth = 2.5;
  g.beginPath(); g.moveTo(-length, 0); g.lineTo(0, 0); g.stroke();
  g.fillStyle = '#ddd';
  g.beginPath(); g.moveTo(0, -4); g.lineTo(9, 0); g.lineTo(0, 4); g.fill();
  g.fillStyle = '#c92a2a';
  g.fillRect(-length, -3, 6, 2);
  g.fillRect(-length, 1, 6, 2);
  g.restore();
}
