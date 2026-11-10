// Haunted Harvest: hovering bats that dive at the sheep, and pumpkins dropping from the sky.

import { clamp } from '../core/util.js';
import { dropWarning, ellipse } from '../core/hud.js';

const HOVER = 0, DIVE = 1, RETURN = 2;

export class Haunted {
  constructor(game) {
    this.game = game;
    this.bats = (game.level.world.bats || []).map(([x, y]) => ({
      x, y, homeX: x, homeY: y, phase: game.rng() * 6, state: HOVER, timer: game.rng() * 1.5, vx: 0, vy: 0, dead: false,
    }));
    this.pumpkins = [];
    this.spawnTimer = 2.5;
  }

  update(dt, prevY) {
    const game = this.game, p = game.player, t = game.t;
    const hover = b => [b.homeX + Math.sin(t * 1.6 + b.phase) * 55, b.homeY + Math.sin(t * 2.3 + b.phase) * 18];

    for (const b of this.bats) {
      if (b.dead) continue;
      b.timer -= dt;
      if (b.state === HOVER) {
        [b.x, b.y] = hover(b);
        if (b.timer <= 0 && Math.abs(p.x - b.x) < 240 && Math.abs(p.y - 22 - b.y) < 230) {
          const a = Math.atan2(p.y - 20 - b.y, p.x - b.x);
          Object.assign(b, { state: DIVE, timer: 0.9, vx: Math.cos(a) * 280, vy: Math.sin(a) * 280 });
          game.audio.play('bat');
        }
      } else if (b.state === DIVE) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.timer <= 0) { b.state = RETURN; b.timer = 1.1; }
      } else {
        const [hx, hy] = hover(b), k = Math.min(1, dt * 2.5);
        b.x += (hx - b.x) * k;
        b.y += (hy - b.y) * k;
        if (b.timer <= 0) { b.state = HOVER; b.timer = 1.4; }
      }
      if (Math.hypot(p.x - b.x, p.y - 14 - b.y) < 22) {
        if (p.vy > 0 && prevY < b.y - 2) {
          b.dead = true;
          game.bounce();
          game.burst(b.x, b.y, 12, '#8f5bff');
          game.audio.play('stomp');
        } else game.hurt();
      }
    }

    // Pumpkins: a warning marker first, then they fall and smash on platforms or the sheep.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.75, 1.4 - game.time / 80);
      this.pumpkins.push({ x: clamp(p.x + (game.rng() - 0.35) * 420, 30, game.level.length), y: -40, warn: 0.75, vy: 0, r: 15, spin: 0 });
    }
    this.pumpkins = this.pumpkins.filter(q => {
      if (q.warn > 0) { q.warn -= dt; return true; }
      q.vy = Math.min(620, q.vy + 900 * dt);
      const py = q.y;
      q.y += q.vy * dt;
      q.spin += dt * 4;
      for (const pl of game.platforms) {
        if (!pl.fallen && q.x > pl.x - 6 && q.x < pl.x + pl.w + 6 && py + q.r <= pl.y + 6 && q.y + q.r >= pl.y) {
          game.burst(q.x, pl.y - 8, 12, '#ff922b', 130);
          game.audio.play('smash');
          return false;
        }
      }
      if (Math.hypot(q.x - p.x, q.y - (p.y - 14)) < q.r + 11) {
        game.hurt();
        game.burst(q.x, q.y, 14, '#ff922b', 150);
        game.audio.play('smash');
        return false;
      }
      return q.y < 540;
    });
  }

  drawWorld(g) {
    const t = this.game.t;
    for (const b of this.bats) if (!b.dead) drawBat(g, b, t);
    for (const q of this.pumpkins) {
      if (q.warn > 0) dropWarning(g, q.x, t, this.game.view.h, '255,140,30');
      else drawPumpkin(g, q);
    }
  }
}

function drawBat(g, b, t) {
  const f = Math.sin(t * 18 + b.phase) * 10;
  g.save();
  g.translate(b.x, b.y);
  g.fillStyle = b.state === DIVE ? '#4a0f3a' : '#24102f';
  g.beginPath();
  g.moveTo(0, -4);
  g.quadraticCurveTo(-14, -14 - f, -26, -2 + f * 0.4);
  g.quadraticCurveTo(-18, 0, -14, 6);
  g.quadraticCurveTo(-8, 2, 0, 8);
  g.quadraticCurveTo(8, 2, 14, 6);
  g.quadraticCurveTo(18, 0, 26, -2 + f * 0.4);
  g.quadraticCurveTo(14, -14 - f, 0, -4);
  g.fill();
  ellipse(g, 0, 0, 6, 8);
  g.beginPath();
  g.moveTo(-5, -6); g.lineTo(-4, -13); g.lineTo(-1, -7);
  g.moveTo(5, -6); g.lineTo(4, -13); g.lineTo(1, -7);
  g.fill();
  g.fillStyle = '#ff3b3b';
  g.fillRect(-4, -2, 3, 3);
  g.fillRect(1, -2, 3, 3);
  g.restore();
}

function drawPumpkin(g, q) {
  g.save();
  g.translate(q.x, q.y);
  g.rotate(Math.sin(q.spin) * 0.25);
  g.fillStyle = '#ff922b';
  ellipse(g, 0, 0, 17, 14);
  g.strokeStyle = '#d9480f';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(-6, 0, 5, 13, 0, 0, Math.PI * 2);
  g.ellipse(6, 0, 5, 13, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#2f9e44';
  g.fillRect(-2, -18, 5, 6);
  g.fillStyle = '#ffe066'; // jack-o'-lantern face
  g.beginPath();
  g.moveTo(-9, -3); g.lineTo(-4, -8); g.lineTo(-2, -2);
  g.moveTo(9, -3); g.lineTo(4, -8); g.lineTo(2, -2);
  g.moveTo(-8, 5); g.lineTo(-4, 3); g.lineTo(0, 6); g.lineTo(4, 3); g.lineTo(8, 5); g.lineTo(0, 10);
  g.fill();
  g.restore();
}
