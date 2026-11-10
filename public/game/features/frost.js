// Frostbite Pass: snowball machines that fire along the ground when the sheep is near.

import { circle, ellipse } from '../core/hud.js';

export class Frost {
  constructor(game) {
    this.game = game;
    this.turrets = (game.level.world.turrets || []).map(([x, y, dir, phase]) => ({ x, y, dir, cooldown: phase, recoil: 0 }));
    this.snowballs = [];
  }

  update(dt) {
    const game = this.game, p = game.player;
    for (const t of this.turrets) {
      t.cooldown -= dt;
      t.recoil = Math.max(0, t.recoil - dt);
      if (t.cooldown > 0) continue;
      t.cooldown = 2.6;
      if (Math.abs(p.x - t.x) < 520) {
        this.snowballs.push({ x: t.x + t.dir * 16, y: t.y - 22, vx: t.dir * 215 });
        game.audio.play('pop');
        t.recoil = 0.2;
      }
    }
    this.snowballs = this.snowballs.filter(b => {
      b.x += b.vx * dt;
      if (Math.abs(b.x - p.x) < 15 && p.y > b.y - 8 && p.y - 26 < b.y + 8) {
        game.hurt();
        game.burst(b.x, b.y, 10, '#fff', 100);
        return false;
      }
      return Math.abs(b.x - p.x) < 700;
    });
  }

  drawWorld(g) {
    for (const t of this.turrets) {
      const kick = t.recoil > 0 ? -4 : 0;
      g.save();
      g.translate(t.x, t.y);
      g.scale(-t.dir, 1);
      g.fillStyle = '#5d7a99';
      g.fillRect(-14, -20, 28, 20);
      g.fillStyle = '#3f5873';
      g.fillRect(-14, -6, 28, 6);
      g.fillStyle = '#7f9db9';
      g.beginPath(); g.arc(0, -20, 10, Math.PI, 0); g.fill();
      g.fillStyle = '#34495e';
      g.fillRect(-24 + kick, -27, 24, 10);
      g.fillStyle = '#1d2b38';
      g.fillRect(-26 + kick, -29, 5, 14);
      g.strokeStyle = '#e8f6ff';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(2, -13); g.lineTo(10, -13);
      g.moveTo(6, -17); g.lineTo(6, -9);
      g.stroke();
      if (t.recoil > 0) { g.fillStyle = '#fffc'; circle(g, -28, -22, 9 * (t.recoil / 0.2) + 3); }
      g.restore();
    }
    for (const b of this.snowballs) {
      g.fillStyle = '#0002';
      ellipse(g, b.x, b.y + 9, 6, 2);
      g.fillStyle = '#fff';
      g.strokeStyle = '#8fb8e0';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(b.x, b.y, 8, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#cfe8ff';
      circle(g, b.x + 2, b.y + 2, 4);
    }
  }
}
