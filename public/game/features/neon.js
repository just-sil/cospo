// Neon Wolfpack: the sheep carries a gun and a shield. Gun-wolves shoot back; every kill repairs
// the shield, checkpoints top up shield and ammo.

import { circle, glow } from '../core/hud.js';
import { drawNeonWolf } from '../themes.js';

const MAX_AMMO = 30, MSG_COLOR = '#7ee7ff';

export class Neon {
  constructor(game) {
    this.game = game;
    this.usesFire = true;
    this.ammo = 10;
    this.shield = 100;
    this.cooldown = 0;
    this.bullets = [];
    this.enemyBullets = [];
    const w = game.level.world;
    this.boxes = (w.ammo || []).map(([x, y]) => ({ x, y, got: false }));
    this.gunWolves = (w.gunWolves || []).map(([x, y, min, max, hp, phase]) => ({
      x, y, min, max, hp, cooldown: phase + 1, dir: -1, patrolDir: 1, dead: false, flash: 0, charging: false, muzzle: 0,
    }));
  }

  fire() {
    const game = this.game, p = game.player;
    if (this.cooldown > 0) return;
    if (this.ammo <= 0) {
      game.audio.play('empty');
      game.say('OUT OF AMMO · find ammo boxes', 0.8, MSG_COLOR);
      this.cooldown = 0.3;
      return;
    }
    this.ammo--;
    this.cooldown = 0.2;
    this.bullets.push({ x: p.x + p.face * 22, y: p.y - 18, vx: p.face * 580, life: 1.1 });
    p.vx -= p.face * 50; // recoil
    game.audio.play('shot');
    game.burst(p.x + p.face * 26, p.y - 18, 3, '#ffd43b', 60);
  }

  repairShield(x, y) {
    const game = this.game;
    this.shield = Math.min(100, this.shield + 35);
    game.say('WOLF DOWN · SHIELD REPAIRED +35', 1.4, MSG_COLOR);
    game.burst(x, y, 16, '#5fd3ff', 150);
    game.burst(x, y, 10, '#fff', 100);
    game.audio.play('repair');
  }

  absorbHit() {
    const game = this.game, p = game.player;
    if (this.shield <= 0) return false;
    this.shield = Math.max(0, this.shield - 25);
    p.invuln = 0.7;
    game.shake = 5;
    game.audio.play('shield');
    game.burst(p.x, p.y - 20, 10, '#4dd0ff', 120);
    if (this.shield <= 0) game.say('SHIELD BROKEN! Kill a wolf to repair', 1.6, MSG_COLOR);
    return true;
  }

  onStomp(w) { this.repairShield(w.x, w.y - 14); }

  onCheckpoint() {
    this.shield = Math.min(100, this.shield + 40);
    this.ammo = Math.min(MAX_AMMO, this.ammo + 6);
    this.game.say('CHECKPOINT: shield +40, ammo +6', 1.4, MSG_COLOR);
  }

  update(dt, prevY) {
    const game = this.game, p = game.player;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (game.input.fire) this.fire();

    for (const a of this.boxes) {
      if (a.got || Math.abs(p.x - a.x) >= 24 || Math.abs(p.y - 12 - a.y) >= 30) continue;
      a.got = true;
      this.ammo = Math.min(MAX_AMMO, this.ammo + 8);
      game.audio.play('ammo');
      game.burst(a.x, a.y, 10, '#ffd43b', 90);
      game.say('AMMO +8', 1.1, MSG_COLOR);
    }

    this.bullets = this.bullets.filter(b => {
      b.x += b.vx * dt;
      b.life -= dt;
      for (const o of game.wolves) {
        if (!o.dead && Math.abs(b.x - o.x) < 20 && b.y > o.y - 36 && b.y < o.y + 2) {
          o.dead = true;
          this.repairShield(o.x, o.y - 14);
          return false;
        }
      }
      for (const q of this.gunWolves) {
        if (!q.dead && Math.abs(b.x - q.x) < 20 && b.y > q.y - 38 && b.y < q.y + 2) {
          q.hp--;
          q.flash = 0.12;
          game.burst(b.x, b.y, 5, '#fff', 80);
          game.audio.play('hit');
          if (q.hp <= 0) { q.dead = true; this.repairShield(q.x, q.y - 14); }
          return false;
        }
      }
      return b.life > 0;
    });

    for (const q of this.gunWolves) {
      if (q.dead) continue;
      q.flash = Math.max(0, q.flash - dt);
      q.muzzle = Math.max(0, q.muzzle - dt);
      const dx = p.x - q.x;
      q.dir = dx >= 0 ? 1 : -1;
      const near = Math.abs(dx) < 520 && Math.abs(p.y - q.y) < 220 && game.onScreen(q.x, 30);
      if (!near) { // slow patrol
        q.charging = false;
        q.x += q.patrolDir * 30 * dt;
        if (q.x < q.min) q.patrolDir = 1;
        if (q.x > q.max) q.patrolDir = -1;
      } else { // aim (laser sight for the last 0.45 s), then shoot
        q.cooldown -= dt;
        q.charging = q.cooldown < 0.45 && q.cooldown > 0;
        if (q.cooldown <= 0) {
          q.cooldown = 1.7 + game.rng() * 0.5;
          q.muzzle = 0.1;
          this.enemyBullets.push({ x: q.x + q.dir * 22, y: q.y - 14, vx: q.dir * 340, life: 2.2 });
          game.audio.play('enemyShot');
        }
      }
      if (Math.abs(p.x - q.x) < 20 && p.y > q.y - 30 && p.y - 22 < q.y) {
        if (p.vy > 0 && prevY < q.y - 14) {
          q.dead = true;
          game.bounce();
          game.audio.play('stomp');
          this.repairShield(q.x, q.y - 14);
        } else game.hurt();
      }
    }

    this.enemyBullets = this.enemyBullets.filter(b => {
      b.x += b.vx * dt;
      b.life -= dt;
      if (Math.abs(b.x - p.x) < 12 && p.y > b.y - 6 && p.y - 26 < b.y + 6) {
        game.hurt();
        game.burst(b.x, b.y, 8, '#ff6b6b', 100);
        return false;
      }
      return b.life > 0;
    });
  }

  drawWorld(g) {
    const t = this.game.t;
    for (const a of this.boxes) {
      if (a.got) continue;
      const y = a.y + Math.sin(t * 4 + a.x) * 2;
      g.save();
      g.translate(a.x, y);
      glow(g, 0, 0, 26, '#ffd43b88', 2);
      g.fillStyle = '#3b4a2a';
      g.fillRect(-12, -9, 24, 18);
      g.strokeStyle = '#ffd43b';
      g.lineWidth = 2;
      g.strokeRect(-12, -9, 24, 18);
      g.fillStyle = '#ffd43b';
      for (let i = -1; i <= 1; i++) g.fillRect(i * 6 - 1.5, -5, 3, 9);
      g.restore();
    }
    for (const q of this.gunWolves) {
      if (q.dead) continue;
      drawNeonWolf(g, q, t, true);
      if (q.charging) { // laser sight
        g.strokeStyle = 'rgba(255,45,85,.6)';
        g.lineWidth = 1.5;
        g.setLineDash([6, 5]);
        g.beginPath();
        g.moveTo(q.x + q.dir * 38, q.y - 14);
        g.lineTo(q.x + q.dir * 340, q.y - 14);
        g.stroke();
        g.setLineDash([]);
      }
    }
    for (const b of this.bullets) {
      g.fillStyle = '#ffe066';
      g.fillRect(b.x - 8, b.y - 1.5, 16, 3);
      glow(g, b.x, b.y, 10, '#ffe06688');
    }
    for (const b of this.enemyBullets) {
      g.fillStyle = '#ff2d55';
      g.fillRect(b.x - 7, b.y - 2, 14, 4);
      glow(g, b.x, b.y, 12, '#ff2d5588');
    }
  }

  drawGear(g) {
    const t = this.game.t;
    g.fillStyle = '#111';
    g.fillRect(12, -24, 18, 6);
    g.fillRect(12, -20, 6, 8);
    g.fillStyle = '#00e5ff';
    g.fillRect(14, -23, 8, 1.5);
    if (this.cooldown > 0.12) { g.fillStyle = '#ffe066'; circle(g, 33, -21, 8); }
    if (this.shield <= 0) return;
    const rgb = this.shield > 60 ? '77,208,255' : this.shield > 25 ? '255,169,77' : '255,77,77';
    g.fillStyle = `rgba(${rgb},${0.1 + this.shield / 100 * 0.16})`;
    g.beginPath();
    g.arc(2, -22, 34, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = `rgba(${rgb},${0.55 + Math.sin(t * 6) * 0.15})`;
    g.lineWidth = 2;
    g.stroke();
    if (this.shield < 50) { // cracks
      g.strokeStyle = `rgba(${rgb},.8)`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-10, -48); g.lineTo(-4, -36); g.lineTo(-12, -28);
      g.moveTo(14, -52); g.lineTo(18, -38);
      g.stroke();
    }
  }

  drawHud(g) {
    g.textAlign = 'left';
    g.font = '700 11px system-ui';
    g.fillStyle = '#fff';
    g.fillText('🛡', 14, 56);
    g.fillStyle = '#0008';
    g.fillRect(32, 46, 130, 12);
    g.fillStyle = this.shield > 60 ? '#4dd0ff' : this.shield > 25 ? '#ffa94d' : '#ff4d4d';
    g.fillRect(32, 46, 130 * this.shield / 100, 12);
    g.strokeStyle = '#fff7';
    g.strokeRect(32, 46, 130, 12);
    g.fillStyle = '#fff';
    g.fillText(Math.round(this.shield) + '%', 36, 56);
    g.fillText('🔫 ' + this.ammo, 14, 78);
    g.fillStyle = '#ffd43b';
    for (let i = 0; i < Math.min(this.ammo, MAX_AMMO); i++) g.fillRect(56 + i * 4, 68, 2, 10);
  }
}
