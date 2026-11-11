// Crystal Depths: crystals break off the ceiling and fall near the sheep, more often deeper in.

import { dropWarning } from '../core/hud.js';

export class Crystal {
  constructor(game) {
    this.game = game;
    this.falling = [];
    this.timer = 2;
  }

  update(dt) {
    const game = this.game, p = game.player, rng = game.rng;
    const depth = Math.min(1, p.x / game.level.goal); // 0 at the start, 1 at the barn

    this.timer -= dt;
    if (this.timer <= 0 && p.x > 300) {
      this.timer = Math.max(1.1, 2.1 - depth);
      const count = depth > 0.5 && rng() < 0.4 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        this.falling.push({ x: Math.max(30, p.x + (rng() - 0.25) * 380 + i * 90), y: -40, warn: 0.8, vy: 0, len: 26 + rng() * 16 });
      }
    }

    this.falling = this.falling.filter(q => {
      if (q.warn > 0) { q.warn -= dt; return true; }
      q.vy = Math.min(660, q.vy + 1100 * dt);
      const py = q.y;
      q.y += q.vy * dt;
      for (const pl of game.platforms) {
        if (!pl.fallen && q.x > pl.x - 6 && q.x < pl.x + pl.w + 6 && py + q.len <= pl.y + 8 && q.y + q.len >= pl.y) {
          game.burst(q.x, pl.y - 6, 10, '#7ee7ff', 120);
          game.audio.play('smash');
          return false;
        }
      }
      if (Math.abs(q.x - p.x) < 13 && q.y + q.len > p.y - 26 && q.y < p.y) {
        game.hurt();
        game.burst(q.x, q.y + q.len, 12, '#7ee7ff', 140);
        game.audio.play('smash');
        return false;
      }
      return q.y < 540;
    });
  }

  drawWorld(g) {
    const { t, view } = this.game;
    for (const q of this.falling) {
      if (q.warn > 0) { dropWarning(g, q.x, t, view.h, '110,231,255'); continue; }
      g.save();
      g.translate(q.x, q.y);
      const gl = g.createLinearGradient(0, 0, 0, q.len);
      gl.addColorStop(0, '#a5f3fc');
      gl.addColorStop(1, '#3b82f6');
      g.fillStyle = gl;
      g.beginPath();
      g.moveTo(-9, 0);
      g.lineTo(9, 0);
      g.lineTo(0, q.len);
      g.closePath();
      g.fill();
      g.strokeStyle = '#e0f7ff';
      g.lineWidth = 1;
      g.stroke();
      g.restore();
    }
  }
}
