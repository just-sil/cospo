// Sky Kingdom: red capes grant 8 s of SUPER SHEEP (free flight, invulnerable, smashes wolves).
// Grey storm boards ('g' platforms) call down lightning if the sheep stays on one for 3 s.

import { clamp } from '../core/util.js';
import { circle } from '../core/hud.js';

const SUPER_TIME = 8, STORM_TIME = 3, MSG_COLOR = '#ffd43b';

export class Sky {
  constructor(game) {
    this.game = game;
    this.capes = (game.level.world.capes || []).map(([x, y]) => ({ x, y, got: false }));
    this.stormBoard = null;  // the storm board the sheep is standing on (or hovering over)
    this.stormTime = 0;
    this.bolt = { time: 0, x: 0, y: 0 };
    this.whiteout = 0;       // full-screen lightning flash
  }

  /** Super mode replaces normal jumping with free flight. */
  steerPlayer(dt, targetVx) {
    const game = this.game, p = game.player, input = game.input;
    if (p.superTime <= 0) return;
    p.superTime -= dt;
    p.invuln = Math.max(p.invuln, 0.2);
    const dy = input.jump ? -1 : clamp(input.stickY + (input.down ? 1 : 0), -1, 1);
    p.vy += (dy * 290 - p.vy) * Math.min(1, dt * 8);
    p.vx += (targetVx * 1.6 - p.vx) * Math.min(1, dt * 6);
    p.y = clamp(p.y, 60, 430);
    if (Math.random() < 0.8) game.particles.add(p.x - p.face * 12, p.y - 14, -p.face * 90, (Math.random() - 0.5) * 30, 0.4, '#ffd43b', 3);
    if (p.superTime <= 0) {
      p.superTime = 0;
      p.invuln = 1.5;
      game.say('Super mode ended', 1.3, MSG_COLOR);
    }
  }

  update(dt) {
    const game = this.game, p = game.player;

    for (const c of this.capes) {
      if (c.got || Math.abs(p.x - c.x) >= 28 || Math.abs(p.y - 20 - c.y) >= 38) continue;
      c.got = true;
      p.superTime = SUPER_TIME;
      p.invuln = 1;
      game.say('⚡ SUPER SHEEP! ⚡', 1.8, MSG_COLOR);
      game.audio.play('power');
      game.burst(p.x, p.y - 20, 30, '#ffd43b', 220);
      game.shake = 8;
    }

    if (p.superTime > 0) {
      this.stormTime = 0;
      this.stormBoard = null;
    } else if (p.on) {
      if (p.on.type !== 'g') { this.stormBoard = null; this.stormTime = 0; }
      else if (this.stormBoard !== p.on) { this.stormBoard = p.on; this.stormTime = 0; }
    }
    const board = this.stormBoard;
    if (board && p.superTime <= 0 && (p.on === board || (!p.on && p.x + 8 > board.x && p.x - 8 < board.x + board.w))) {
      const before = this.stormTime;
      this.stormTime += dt;
      if (this.stormTime > 1.4 && Math.floor(this.stormTime * 3) !== Math.floor(before * 3)) game.audio.play('warn');
      if (this.stormTime >= STORM_TIME) {
        this.stormTime = 0;
        this.bolt = { time: 0.4, x: p.x, y: p.y };
        this.whiteout = 0.85;
        game.shake = 12;
        game.audio.play('thunder');
        game.burst(p.x, p.y - 20, 26, '#fff59d', 230);
        game.hurt();
      }
    }
    if (this.bolt.time > 0) this.bolt.time -= dt;
    this.whiteout = Math.max(0, this.whiteout - dt * 2.4);

    if (p.superTime > 0) { // super sheep flattens wolves on contact
      for (const o of game.wolves) {
        if (o.dead || Math.abs(p.x - o.x) >= 38 || Math.abs(p.y - o.y) >= 46) continue;
        o.dead = true;
        game.audio.play('stomp');
        game.burst(o.x, o.y - 14, 18, '#ffd43b', 200);
        game.burst(o.x, o.y - 14, 10, '#fff', 120);
        game.shake = 5;
      }
    }
  }

  drawWorld(g) {
    const game = this.game, p = game.player, t = game.t;

    if (this.stormBoard && this.stormTime > 0.6 && game.playing) { // storm cloud + countdown
      const k = Math.min(1, this.stormTime / STORM_TIME);
      g.save();
      g.fillStyle = `rgba(60,66,90,${0.35 + k * 0.5})`;
      for (let i = 0; i < 5; i++) circle(g, p.x - 50 + i * 25, p.y - 120 + Math.sin(t * 4 + i) * 4, 22 + k * 8);
      g.font = '800 18px system-ui';
      g.textAlign = 'center';
      g.lineWidth = 4;
      g.strokeStyle = '#000a';
      const label = `⚡ ${Math.ceil(STORM_TIME - this.stormTime)} · LEAVE THE BOARD!`;
      g.strokeText(label, p.x, p.y - 64);
      g.fillStyle = Math.floor(t * 8) % 2 ? '#ffe066' : '#fff';
      g.fillText(label, p.x, p.y - 64);
      if (this.stormTime > 1.6) {
        g.strokeStyle = `rgba(255,230,120,${0.2 + Math.random() * 0.5})`;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(p.x - 6 + Math.random() * 12, p.y - 100);
        g.lineTo(p.x - 8 + Math.random() * 16, p.y - 70);
        g.stroke();
      }
      g.restore();
    }

    if (this.bolt.time > 0) { // jagged lightning bolt from the sky to the sheep
      const b = this.bolt;
      g.save();
      g.strokeStyle = `rgba(255,255,255,${Math.min(1, b.time * 4)})`;
      g.lineWidth = 5;
      g.lineJoin = 'round';
      g.beginPath();
      let x = b.x + 30, y = -20;
      g.moveTo(x, y);
      while (y < b.y) {
        y += 28;
        x += (Math.random() - 0.5) * 46;
        if (y > b.y) break;
        g.lineTo(x, y);
      }
      g.lineTo(b.x, b.y);
      g.stroke();
      g.strokeStyle = 'rgba(160,190,255,.6)';
      g.lineWidth = 14;
      g.stroke();
      g.restore();
    }

    for (const c of this.capes) {
      if (c.got) continue;
      g.save();
      g.translate(c.x, c.y + Math.sin(t * 3 + c.x) * 5);
      const gl = g.createRadialGradient(0, 0, 3, 0, 0, 40);
      gl.addColorStop(0, 'rgba(255,221,87,.7)');
      gl.addColorStop(1, 'rgba(255,200,40,0)');
      g.fillStyle = gl;
      g.fillRect(-40, -40, 80, 80);
      g.rotate(Math.sin(t * 2 + c.x) * 0.12);
      g.fillStyle = '#e03131';
      g.strokeStyle = '#ffd43b';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-14, -14);
      g.lineTo(14, -14);
      g.quadraticCurveTo(18, 6, 10, 16);
      g.quadraticCurveTo(0, 10, -10, 16);
      g.quadraticCurveTo(-18, 6, -14, -14);
      g.closePath();
      g.fill();
      g.stroke();
      emblem(g);
      g.restore();
    }
  }

  drawGear(g) {
    if (this.game.player.superTime <= 0) return;
    const f = Math.sin(this.game.t * 18) * 5;
    const gl = g.createRadialGradient(2, -22, 4, 2, -22, 50);
    gl.addColorStop(0, 'rgba(255,221,87,.55)');
    gl.addColorStop(1, 'rgba(255,200,40,0)');
    g.fillStyle = gl;
    g.fillRect(-52, -74, 104, 104);
    g.fillStyle = '#e03131';
    g.strokeStyle = '#ffd43b';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(-4, -32);
    g.quadraticCurveTo(-24, -30 + f, -40, -20 + f * 1.6);
    g.quadraticCurveTo(-26, -16, -30, -6 + f);
    g.quadraticCurveTo(-14, -14, -4, -10);
    g.closePath();
    g.fill();
    g.stroke();
    // chest emblem
    g.fillStyle = '#ffd43b';
    g.beginPath();
    g.moveTo(0, -31); g.lineTo(10, -31); g.lineTo(10, -23); g.lineTo(5, -18); g.lineTo(0, -23);
    g.closePath();
    g.fill();
    g.fillStyle = '#e03131';
    g.beginPath();
    g.moveTo(6, -29); g.lineTo(3, -24); g.lineTo(6, -24); g.lineTo(4, -20); g.lineTo(8, -26); g.lineTo(5, -26);
    g.closePath();
    g.fill();
  }

  drawHud(g) {
    const { view, t, player } = this.game;
    if (this.whiteout > 0) {
      g.fillStyle = `rgba(255,255,255,${this.whiteout * 0.7})`;
      g.fillRect(0, 0, view.w, view.h);
    }
    if (player.superTime > 0) {
      g.textAlign = 'left';
      g.font = '800 11px system-ui';
      g.fillStyle = '#ffd43b';
      g.fillText('⚡ SUPER', 14, 56);
      g.fillStyle = '#0008';
      g.fillRect(70, 46, 120, 12);
      g.fillStyle = player.superTime < 2 && Math.floor(t * 8) % 2 ? '#fff' : '#ffd43b';
      g.fillRect(70, 46, 120 * player.superTime / SUPER_TIME, 12);
      g.strokeStyle = '#fff7';
      g.strokeRect(70, 46, 120, 12);
    }
  }
}

/** Yellow shield with a red lightning bolt, drawn on cape pickups. */
function emblem(g) {
  g.fillStyle = '#ffd43b';
  g.beginPath();
  g.moveTo(-5, -9); g.lineTo(6, -9); g.lineTo(6, 0); g.lineTo(0, 6); g.lineTo(-5, 0);
  g.closePath();
  g.fill();
  g.fillStyle = '#e03131';
  g.beginPath();
  g.moveTo(2, -7); g.lineTo(-2, -1); g.lineTo(1, -1); g.lineTo(-1, 4); g.lineTo(4, -3); g.lineTo(1, -3);
  g.closePath();
  g.fill();
}
