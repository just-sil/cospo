import { TAU } from './util.js';

/** Short-lived additive sparks: jump puffs, hits, pickups, explosions. Purely cosmetic. */
export class Particles {
  constructor() { this.list = []; }

  add(x, y, vx, vy, life, color, size) {
    this.list.push({ x, y, vx, vy, life, maxLife: life, color, size });
  }

  /** A radial explosion of `count` particles with a slight upward kick. */
  burst(x, y, count, color, speed = 160) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, v = speed * Math.random();
      this.add(x, y, Math.cos(a) * v, Math.sin(a) * v - 60, 0.4 + Math.random() * 0.4, color, 2 + Math.random() * 3);
    }
  }

  update(dt) {
    this.list = this.list.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      p.life -= dt;
      return p.life > 0;
    });
  }

  draw(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      g.globalAlpha = p.life / p.maxLife;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, TAU);
      g.fill();
    }
    g.restore();
  }
}
