// Starfall Run: an auto-scrolling space shooter-dodger. Fly the rocket-sheep through asteroids,
// spiked mines, gates, UFO lasers, homing wolf rockets and meteor showers. Black holes pull you in;
// NITRO (5 s, burns 60% fuel) is strong enough to escape them.

import { clamp, seededRandom, TAU, wrap } from '../core/util.js';
import { axisY } from '../core/input.js';
import * as hud from '../core/hud.js';
import { circle, ellipse, poly } from '../core/hud.js';
import { Mode } from './mode.js';

const LAYOUT_SEED = 4242;  // the asteroid field is the same on every attempt
const NITRO_TIME = 5;
const SWALLOWED = 'Swallowed by a black hole! Hit NITRO (needs 60% fuel) before the disk grabs you.';

const STARS = Array.from({ length: 90 }, () => ({ x: Math.random() * 1200, y: Math.random() * 450, z: 0.05 + Math.random() * 0.4, s: 0.5 + Math.random() * 1.6 }));

/** Builds the fixed obstacle layout. The call order matters: it consumes the seeded sequence. */
export function buildSpaceLayout(length) {
  const r = seededRandom(LAYOUT_SEED);
  const blackHoles = [2700, 5200, 7600].map((x, i) => ({ x, y: 215 + (i % 2) * 18, R: 260, core: 28 }));
  const nearHole = x => blackHoles.some(b => Math.abs(x - b.x) < 450);
  const end = length - 300;

  const asteroids = [];
  for (let x = 600; x < end; x += 150 + r() * 120) {
    if (nearHole(x)) continue;
    asteroids.push({
      x, y: 40 + r() * 370, r: 16 + r() * 28, vx: -(5 + r() * 20), vy: (r() - 0.5) * 30, angle: r() * 6, spin: (r() - 0.5) * 1.5,
      shape: Array.from({ length: 9 }, () => 0.75 + r() * 0.4),
    });
  }
  const mines = [];
  for (let x = 800; x < end; x += 260 + r() * 160) if (!nearHole(x)) mines.push({ x, y: 50 + r() * 350 });
  const gates = [1100, 2000, 3900, 4600, 6200, 6900, 8300].map(x => ({ x, gapY: 80 + r() * 190, gapH: 150 }));
  const ufos = [1500, 2300, 3300, 4200, 5800, 6500, 7100, 8000, 8500].map(x => ({ x, y: 80 + r() * 290, amp: 40 + r() * 40, phase: r() * 6, cooldown: 1 + r(), cy: 200 }));
  const cans = [700, 1300, 1800, 2300, 3000, 3500, 4000, 4400, 4900, 5500, 6000, 6600, 7100, 7900, 8200].map(x => ({ x, y: 60 + r() * 330, got: false }));
  return { blackHoles, asteroids, mines, gates, ufos, cans };
}

export class Space extends Mode {
  constructor(level, env) {
    super(level, env);
    this.hearts = this.maxHearts = level.hearts;
    this.ship = { sx: 110, sy: 225, fuel: 100, invuln: 0, nitro: 0 }; // sx is a screen x; the world x is cam + sx
    this.bolts = [];
    this.rockets = [];
    this.meteors = [];
    this.rocketTimer = 3;
    this.meteorTimer = 2;
    this.cause = '';
    Object.assign(this, buildSpaceLayout(level.length));
  }

  get controls() { return { jump: false, nitro: true }; }
  get shipX() { return this.cam + this.ship.sx; }

  press(action) {
    const s = this.ship;
    if (action !== 'nitro' || !this.playing || s.nitro > 0 || s.fuel < 5) return;
    s.nitro = NITRO_TIME;
    this.audio.play('nitro');
    this.shake = 6;
  }

  damage(x, y) {
    if (this.ship.invuln > 0 || !this.playing) return;
    this.hearts--;
    this.ship.invuln = 1.4;
    this.shake = 10;
    this.audio.play('hurt');
    this.burst(x, y, 16, '#ff6b6b', 180);
    if (this.hearts <= 0) {
      this.burst(x, y, 40, '#ffd43b', 260);
      this.audio.play('boom');
      this.finish(false);
    }
  }

  update(dt) {
    if (!this.tick(dt)) return;
    const s = this.ship, { w: W, h: H } = this.view, input = this.input;

    // The screen scrolls by itself, a bit faster as you go, and slows down near black holes.
    const nearHole = this.blackHoles.some(b => this.cam + W > b.x - b.R - 60 && this.cam < b.x + b.R + 60);
    this.cam = Math.min(this.level.length - W + 60, this.cam + (125 + this.cam / 9000 * 75) * (nearHole ? 0.45 : 1) * dt);
    s.invuln = Math.max(0, s.invuln - dt);

    let kx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.stickX;
    let ky = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.stickY;
    const len = Math.hypot(kx, ky);
    if (len > 1) { kx /= len; ky /= len; }
    const boosting = s.nitro > 0, speed = boosting ? 380 : s.fuel > 0 ? 230 : 110;
    let vx = kx * speed, vy = ky * speed, pull = 0;
    const px = this.shipX;
    for (const b of this.blackHoles) { // gravity with a swirl
      const dx = b.x - px, dy = b.y - s.sy, d = Math.hypot(dx, dy) || 1;
      if (d >= b.R) continue;
      const k = Math.pow(1 - d / b.R, 1.2), f = (boosting ? 100 : 1200) * k;
      vx += dx / d * f - dy / d * f * 0.3;
      vy += dy / d * f + dx / d * f * 0.3;
      pull = Math.max(pull, k);
      if (d < b.core + 8) {
        this.cause = SWALLOWED;
        this.audio.play('blackHole');
        this.burst(px, s.sy, 30, '#b197fc', 200);
        this.finish(false);
        return;
      }
    }
    s.sx = clamp(s.sx + vx * dt, 20, W - 20);
    s.sy = clamp(s.sy + vy * dt, 26, H - 26);
    s.fuel = Math.max(0, s.fuel - 0.7 * dt);
    if (boosting) {
      s.nitro -= dt;
      s.fuel = Math.max(0, s.fuel - 12 * dt);
      if (s.fuel <= 0) s.nitro = 0;
    }

    const x = this.shipX, y = s.sy;
    this.particles.add(x - 20, y + (Math.random() - 0.5) * 6, -(boosting ? 300 : 120), (Math.random() - 0.5) * 30, 0.35, boosting ? '#7ee7ff' : '#ffa94d', boosting ? 4 : 2.5);
    this.audio.engine(boosting ? 170 : 60 + pull * 60, boosting ? 0.045 : 0.014 + pull * 0.05);

    for (const a of this.asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.y < 30 || a.y > 420) a.vy *= -1;
      a.angle += a.spin * dt;
      if (Math.abs(a.x - x) < a.r + 20 && Math.hypot(a.x - x, a.y - y) < a.r * 0.85 + 11) this.damage(x, y);
    }
    for (const m of this.mines) if (Math.abs(m.x - x) < 40 && Math.hypot(m.x - x, m.y - y) < 27) this.damage(x, y);
    for (const q of this.gates) if (Math.abs(q.x - x) < 24 && (y - 11 < q.gapY || y + 11 > q.gapY + q.gapH)) this.damage(x, y);
    for (const u of this.ufos) {
      u.cy = clamp(u.y + Math.sin(this.t * 1.2 + u.phase) * u.amp, 40, 410);
      const ux = u.x - this.cam;
      if (ux > 30 && ux < W - 30 && (u.cooldown -= dt) <= 0) { // aimed laser shots while on screen
        u.cooldown = 2.1;
        const a = Math.atan2(y - u.cy, x - u.x);
        this.bolts.push({ x: u.x, y: u.cy, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, life: 5 });
        this.audio.play('laser');
      }
      if (Math.hypot(u.x - x, u.cy - y) < 38) this.damage(x, y);
    }
    this.bolts = this.bolts.filter(b => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (Math.hypot(b.x - x, b.y - y) < 19) { this.damage(x, y); return false; }
      return b.life > 0;
    });

    this.rocketTimer -= dt;
    if (this.cam > 900 && this.rocketTimer <= 0) {
      this.rocketTimer = this.cam > 5000 ? 2.8 : 4.2;
      this.rockets.push({ x: this.cam + W + 30, y: 40 + this.rng() * 370, angle: Math.PI, life: 7 });
      this.audio.play('whoosh');
    }
    this.rockets = this.rockets.filter(r => { // homing, with a limited turn rate
      const target = Math.atan2(y - r.y, x - r.x), diff = Math.atan2(Math.sin(target - r.angle), Math.cos(target - r.angle));
      r.angle += clamp(diff, -1.3 * dt, 1.3 * dt);
      r.x += Math.cos(r.angle) * 215 * dt;
      r.y += Math.sin(r.angle) * 215 * dt;
      r.life -= dt;
      if (Math.hypot(r.x - x, r.y - y) < 24) {
        this.damage(x, y);
        this.burst(r.x, r.y, 20, '#ffa94d', 200);
        this.audio.play('boom');
        return false;
      }
      if (r.life <= 0) { this.burst(r.x, r.y, 10, '#ffa94d', 120); return false; }
      this.particles.add(r.x - Math.cos(r.angle) * 16, r.y - Math.sin(r.angle) * 16, 0, 0, 0.4, '#ffa94d', 3);
      return true;
    });

    this.meteorTimer -= dt;
    if (this.meteorTimer <= 0 && this.cam > 300) {
      this.meteorTimer = clamp(2.4 - this.cam / 9000 * 1.3, 1, 2.4);
      this.meteors.push({ x: this.cam + W * (0.2 + this.rng() * 0.8), y: -30, warn: 0.9, vx: -120, vy: 340 });
      this.audio.play('warn');
    }
    this.meteors = this.meteors.filter(m => {
      if (m.warn > 0) { m.warn -= dt; return true; }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (Math.random() < 0.6) this.particles.add(m.x, m.y, 60, -40, 0.5, '#ff922b', 3);
      if (Math.hypot(m.x - x, m.y - y) < 24) { this.damage(x, y); this.burst(m.x, m.y, 14, '#ff922b', 160); return false; }
      return m.y < H + 50;
    });

    for (const c of this.cans) {
      if (c.got || Math.hypot(c.x - x, c.y - y) >= 28) continue;
      c.got = true;
      this.clovers++;
      s.fuel = Math.min(100, s.fuel + 20);
      this.audio.play('fuel');
      this.burst(c.x, c.y, 14, '#ff6b6b', 140);
    }
    if (this.playing && x >= this.level.length - 30) {
      this.burst(x, y, 40, '#ffd43b', 260);
      this.finish(true);
    }
  }

  finish(won) {
    super.finish(won, { cloverTotal: this.cans.length, hearts: this.hearts, statLabel: 'Fuel bags', message: this.cause || undefined });
  }

  // -------------------------------------------------------------------------------------------

  draw(g) {
    const { view, t, ship: s } = this, { w: W, h: H } = view, cam = this.cam;
    const x = this.shipX, y = s.sy, boosting = s.nitro > 0;

    hud.sky(g, view, [[0, '#05030f'], [1, '#1a0a30']]);
    g.fillStyle = '#3a1f6a66';
    circle(g, wrap(500 - cam * 0.05, 1700) - 250, 150, 130);
    const planetX = wrap(900 - cam * 0.08, 1700) - 250;
    g.fillStyle = '#e8895c';
    circle(g, planetX, 320, 50);
    g.fillStyle = '#0004';
    circle(g, planetX + 15, 330, 48);
    for (const star of STARS) {
      g.fillStyle = `rgba(255,255,255,${0.35 + star.z})`;
      g.fillRect(wrap(star.x - cam * star.z, W), star.y, star.s, star.s);
    }

    g.save();
    this.applyShake(g);
    g.translate(-Math.round(cam), 0);
    const visible = wx => wx > cam - 300 && wx < cam + W + 300;

    for (const b of this.blackHoles) if (visible(b.x)) drawBlackHole(g, b, t);
    for (const q of this.gates) {
      if (!visible(q.x)) continue;
      g.fillStyle = '#4b5068';
      g.fillRect(q.x - 14, 0, 28, q.gapY);
      g.fillRect(q.x - 14, q.gapY + q.gapH, 28, H);
      g.fillStyle = '#ff6b6b';
      for (let gx = q.x - 14; gx < q.x + 14; gx += 7) {
        poly(g, gx, q.gapY, gx + 3.5, q.gapY + 14, gx + 7, q.gapY);
        poly(g, gx, q.gapY + q.gapH, gx + 3.5, q.gapY + q.gapH - 14, gx + 7, q.gapY + q.gapH);
      }
    }
    for (const m of this.mines) {
      if (!visible(m.x)) continue;
      g.save();
      g.translate(m.x, m.y);
      g.rotate(t);
      g.fillStyle = '#ff4d4d';
      for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); poly(g, -4, -10, 0, -23, 4, -10); }
      g.fillStyle = '#2b2d3a';
      circle(g, 0, 0, 12);
      g.fillStyle = '#ff4d4d';
      g.fillRect(-2, -2, 4, 4);
      g.restore();
    }
    for (const a of this.asteroids) {
      if (!visible(a.x)) continue;
      g.save();
      g.translate(a.x, a.y);
      g.rotate(a.angle);
      g.fillStyle = '#6b6470';
      g.beginPath();
      a.shape.forEach((k, i) => {
        const ang = i / 9 * TAU, px = Math.cos(ang) * a.r * k, py = Math.sin(ang) * a.r * k;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      });
      g.fill();
      g.fillStyle = '#4a4550';
      g.beginPath();
      g.arc(a.r * 0.3, -a.r * 0.2, a.r * 0.22, 0, TAU);
      g.arc(-a.r * 0.35, a.r * 0.25, a.r * 0.15, 0, TAU);
      g.fill();
      g.restore();
    }
    for (const c of this.cans) {
      if (c.got || !visible(c.x)) continue;
      g.save();
      g.translate(c.x, c.y + Math.sin(t * 4 + c.x) * 3);
      hud.glow(g, 0, 0, 32, '#ff6b6b99', 2);
      g.fillStyle = '#e03131';
      g.fillRect(-10, -13, 20, 26);
      g.fillStyle = '#a51111';
      g.fillRect(-10, 7, 20, 6);
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(0, -8);
      g.quadraticCurveTo(6, 0, 0, 4);
      g.quadraticCurveTo(-6, 0, 0, -8);
      g.fill();
      g.restore();
    }
    for (const u of this.ufos) {
      if (!visible(u.x)) continue;
      g.save();
      g.translate(u.x, u.cy);
      g.fillStyle = '#8be9fd88';
      g.beginPath(); g.ellipse(0, -6, 15, 11, 0, Math.PI, 0); g.fill();
      wolfHead(g, 0, -8, 1.1);
      g.fillStyle = '#9aa0b5';
      ellipse(g, 0, 0, 32, 10);
      g.fillStyle = '#5b6078';
      g.beginPath(); g.ellipse(0, 3, 32, 6, 0, 0, Math.PI); g.fill();
      for (let i = -2; i <= 2; i++) {
        g.fillStyle = Math.floor(t * 6 + i) % 2 ? '#ffd43b' : '#ff6b6b';
        g.fillRect(i * 10 - 2, -1, 4, 3);
      }
      g.restore();
    }
    for (const b of this.bolts) hud.glow(g, b.x, b.y, 14, '#b2ff59');
    for (const r of this.rockets) drawWolfRocket(g, r);
    for (const m of this.meteors) {
      if (m.warn > 0) { // flashing arrow at the top of the screen
        g.fillStyle = `rgba(255,70,70,${0.5 + Math.sin(t * 20) * 0.4})`;
        poly(g, m.x, 6, m.x - 10, 26, m.x + 10, 26);
        g.fillStyle = '#fff';
        g.fillRect(m.x - 1.5, 12, 3, 8);
        continue;
      }
      const tail = g.createLinearGradient(m.x, m.y, m.x + m.vx * 0.5, m.y - m.vy * 0.5);
      tail.addColorStop(0, '#ffd43b');
      tail.addColorStop(1, '#0000');
      g.strokeStyle = tail;
      g.lineWidth = 12;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(m.x, m.y);
      g.lineTo(m.x - m.vx * 0.5, m.y - m.vy * 0.5);
      g.stroke();
      g.fillStyle = '#ff922b';
      circle(g, m.x, m.y, 12);
      g.fillStyle = '#fff3bf';
      circle(g, m.x - 3, m.y - 3, 5);
    }
    const goal = this.level.length; // wormhole exit
    if (visible(goal)) {
      g.save();
      g.translate(goal, 225);
      g.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        g.strokeStyle = `rgba(${120 + i * 25},${200 - i * 20},255,.7)`;
        g.beginPath();
        g.ellipse(0, 0, 14 + i * 10 + Math.sin(t * 3 + i) * 3, 60 + i * 28, 0, 0, TAU);
        g.stroke();
      }
      g.restore();
    }
    this.particles.draw(g);
    this.drawShip(g, x, y, boosting);
    g.restore();
    this.drawHud(g, x, boosting);
  }

  drawShip(g, x, y, boosting) {
    const s = this.ship;
    g.save();
    g.translate(x, y);
    if (s.invuln > 0 && Math.floor(this.t * 20) % 2) g.globalAlpha = 0.4;
    g.rotate(clamp(axisY(this.input), -1, 1) * 0.25);
    if (boosting) { g.fillStyle = '#7ee7ff'; poly(g, -14, -7, -46 - Math.random() * 14, 0, -14, 7); }
    g.fillStyle = '#ffa94d';
    poly(g, -14, -5, -26 - Math.random() * 6, 0, -14, 5);
    g.fillStyle = '#c9d1e8';
    ellipse(g, 0, 4, 22, 9);
    g.fillStyle = '#e03131';
    g.fillRect(-20, 3, 8, 4);
    poly(g, -12, 6, -22, 15, -4, 9);
    g.fillStyle = '#8be9fd99'; // glass dome with the sheep inside
    g.beginPath(); g.arc(4, -1, 13, Math.PI, 0); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(2, -4, 7, 0, TAU); g.arc(-3, -2, 5, 0, TAU); g.fill();
    g.fillStyle = '#2f2938';
    ellipse(g, 8, -2, 5, 6);
    g.fillStyle = '#fff';
    g.fillRect(9, -5, 3, 3);
    g.restore();
  }

  drawHud(g, x, boosting) {
    const { view, t, ship: s } = this;
    hud.hearts(g, this.hearts, this.maxHearts, 30);
    g.font = '700 14px system-ui';
    g.fillStyle = '#fff';
    g.fillText(`🛢 ${this.clovers}/${this.cans.length}`, 22 + this.maxHearts * 26, 28);
    g.font = '700 12px system-ui';
    g.fillText('⛽', 14, 52);
    hud.meter(g, 34, 40, 150, 14, s.fuel / 100, hud.fuelColor(s.fuel / 100, t));
    g.fillStyle = '#fff'; // the 60% mark nitro needs
    g.fillRect(34 + 90, 37, 2, 20);
    g.font = '700 9px system-ui';
    g.fillText('60%', 34 + 80, 66);
    if (boosting) {
      g.fillStyle = '#0008';
      g.fillRect(34, 70, 150, 8);
      g.fillStyle = '#7ee7ff';
      g.fillRect(34, 70, 150 * s.nitro / NITRO_TIME, 8);
    }
    hud.titleBar(g, view, this.level.title, x / this.level.length);

    let msg = this.time < 7 ? 'Joystick = fly · dodge everything · NITRO (5s, costs 60% fuel) breaks black holes' : '';
    const ahead = this.blackHoles.find(b => b.x + b.R > x && b.x - b.R - 260 < x);
    if (ahead && !boosting) {
      msg = Math.floor(t * 4) % 2 ? (s.fuel >= 60 ? '⚠ BLACK HOLE AHEAD · hit NITRO before the disk!' : '⚠ BLACK HOLE · not enough fuel! Grab fuel bags (need 60%)') : '';
    }
    if (msg) hud.banner(g, view, msg, ahead ? '#ffa94d' : '#fff');
    g.textAlign = 'left';
  }
}

function drawBlackHole(g, b, t) {
  g.save();
  g.translate(b.x, b.y);
  const disk = g.createRadialGradient(0, 0, b.core, 0, 0, b.R);
  disk.addColorStop(0, 'rgba(255,200,120,.9)');
  disk.addColorStop(0.25, 'rgba(255,110,40,.55)');
  disk.addColorStop(0.6, 'rgba(150,40,200,.3)');
  disk.addColorStop(1, 'rgba(40,0,80,0)');
  g.fillStyle = disk;
  circle(g, 0, 0, b.R);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) { // spiral arms
    g.save();
    g.rotate(t * (0.9 - i * 0.08) + i * 1.26);
    g.strokeStyle = `rgba(255,${150 + i * 20},${90 + i * 30},.35)`;
    g.lineWidth = 3 + i;
    g.beginPath();
    for (let a = 0; a < 4.2; a += 0.12) {
      const r = b.core + 10 + a * (b.R - b.core - 20) / 4.2;
      a ? g.lineTo(Math.cos(a + i) * r, Math.sin(a + i) * r) : g.moveTo(Math.cos(a + i) * r, Math.sin(a + i) * r);
    }
    g.stroke();
    g.restore();
  }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000';
  circle(g, 0, 0, b.core);
  g.strokeStyle = '#ffe3a8';
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, b.core + 2, 0, TAU); g.stroke();
  g.restore();
}

/** A tiny wolf face (UFO pilots, rocket riders). */
function wolfHead(g, x, y, k) {
  g.fillStyle = '#8d93a5';
  circle(g, x, y, 6 * k);
  g.beginPath();
  g.moveTo(x - 5 * k, y - 3 * k); g.lineTo(x - 4 * k, y - 10 * k); g.lineTo(x - 1 * k, y - 5 * k);
  g.moveTo(x + 5 * k, y - 3 * k); g.lineTo(x + 4 * k, y - 10 * k); g.lineTo(x + 1 * k, y - 5 * k);
  g.fill();
  g.fillStyle = '#ff3b3b';
  g.fillRect(x - 3.5 * k, y - 2 * k, 2.2 * k, 2 * k);
  g.fillRect(x + 1.3 * k, y - 2 * k, 2.2 * k, 2 * k);
}

function drawWolfRocket(g, r) {
  g.save();
  g.translate(r.x, r.y);
  g.rotate(r.angle);
  g.fillStyle = '#ffa94d';
  poly(g, -18, 0, -30 - Math.random() * 8, -5, -30 - Math.random() * 8, 5);
  g.fillStyle = '#e03131';
  g.beginPath();
  g.moveTo(-16, -9); g.lineTo(-24, -17); g.lineTo(-8, -9);
  g.moveTo(-16, 9); g.lineTo(-24, 17); g.lineTo(-8, 9);
  g.fill();
  g.fillStyle = '#e8e8f0';
  g.beginPath();
  g.moveTo(-18, -8); g.lineTo(8, -8);
  g.quadraticCurveTo(26, 0, 8, 8);
  g.lineTo(-18, 8);
  g.fill();
  g.fillStyle = '#222';
  circle(g, -2, 0, 7);
  g.rotate(-r.angle);
  wolfHead(g, -2, 0, 0.9);
  g.restore();
}
