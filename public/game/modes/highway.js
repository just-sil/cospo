// Sunset Highway: ride a motorbike over a rolling road. Throttle burns fuel, red fuel bags refill
// it, ramps launch you, rocks crash you, puddles slow you down. Run dry and you lose.

import { approach, clamp, TAU } from '../core/util.js';
import { axisX, axisY } from '../core/input.js';
import * as hud from '../core/hud.js';
import { circle, ellipse, poly } from '../core/hud.js';
import { Mode } from './mode.js';

const MAX_SPEED = 360, JUMP_SPEED = 480, GRAVITY = 1200;
const ROCKS = [900, 1500, 1900, 2500, 2900, 3300, 3900, 4300, 4700, 5200, 5600, 6100];
const RAMPS = [1200, 2200, 3600, 5000];
const PUDDLES = [1700, 3100, 4500, 5800];

/** Road surface height at world x: flat at the start, then gently rolling hills. */
export function roadY(x) {
  const hills = clamp((x - 200) / 500, 0, 1);
  return 350 + hills * (Math.sin(x / 300) * 30 + Math.sin(x / 110) * 7);
}

export class Highway extends Mode {
  constructor(level, env) {
    super(level, env);
    this.bike = { x: 60, y: roadY(60), v: 0, vy: 0, grounded: true, angle: 0, fuel: 60, wheel: 0, lastRamp: -1 };
    this.jumpBuffer = 0;
    this.rocks = ROCKS.map(x => ({ x, hit: false }));
    // Fuel bags every ~420–500 px; every third one floats higher and needs a hop.
    this.fuelBags = [];
    for (let x = 520, i = 0; x < 6600; i++) {
      this.fuelBags.push({ x, lift: i % 3 === 1 ? 75 : 0, got: false });
      x += 420 + (i % 3) * 40;
    }
  }

  press(action) {
    if (action === 'jump' && this.playing) this.jumpBuffer = 0.12;
  }

  update(dt) {
    if (!this.tick(dt)) return;
    const b = this.bike;
    this.jumpBuffer -= dt;

    const throttle = axisX(this.input);
    if (throttle > 0 && b.fuel > 0) {
      b.v += throttle * 260 * dt;
      b.fuel -= 9 * throttle * dt;
      if (Math.random() < 0.5) this.particles.add(b.x - 26, b.y - 8, -60 - b.v * 0.2, -10, 0.4, '#aaa', 2.5);
    } else {
      b.fuel = Math.max(0, b.fuel - 1.2 * dt); // idling still burns a little
      if (throttle < 0) b.v += throttle * 480 * dt; // brake
    }
    b.v *= Math.pow(0.7, dt);
    this.audio.engine(55 + b.v * 0.55, throttle > 0 ? 0.035 : 0.012);
    if (b.grounded) b.v += (roadY(b.x + 6) - roadY(b.x - 6)) / 12 * 700 * dt; // downhill speeds up
    b.v = clamp(b.v, 0, MAX_SPEED);
    b.x += b.v * dt;
    b.wheel += b.v * dt / 10;

    if (this.jumpBuffer > 0 && b.grounded) {
      b.vy = -JUMP_SPEED;
      b.grounded = false;
      this.jumpBuffer = 0;
    }
    if (b.grounded) {
      b.y = roadY(b.x);
      for (const r of RAMPS) {
        if (Math.abs(b.x - r) < 12 && b.v > 130 && b.lastRamp !== r) {
          b.lastRamp = r;
          this.audio.play('jump');
          b.vy = -280 - b.v * 0.55;
          b.grounded = false;
          this.burst(b.x, b.y, 8, '#ffd43b', 90);
        }
      }
    }
    if (!b.grounded) {
      b.vy += GRAVITY * dt;
      b.y += b.vy * dt;
      const ground = roadY(b.x);
      if (b.y >= ground) {
        b.y = ground;
        b.grounded = true;
        if (b.vy > 250) { this.shake = 4; this.burst(b.x, b.y, 8, '#c9a27a', 80); }
        b.vy = 0;
      }
    }
    const targetAngle = b.grounded ? Math.atan2(roadY(b.x + 10) - roadY(b.x - 10), 20) : clamp(b.vy * 0.0007, -0.5, 0.5);
    b.angle += (targetAngle - b.angle) * approach(8, dt);

    for (const r of this.rocks) {
      if (r.hit || Math.abs(b.x - r.x) >= 20 || b.y <= roadY(r.x) - 14) continue;
      r.hit = true;
      this.audio.play('crash');
      b.v *= 0.2;
      b.fuel = Math.max(0, b.fuel - 8);
      this.shake = 9;
      this.burst(r.x, roadY(r.x) - 10, 14, '#aaa', 150);
    }
    for (const p of PUDDLES) if (b.grounded && b.x > p && b.x < p + 80) b.v = Math.min(b.v, 150);
    for (const c of this.fuelBags) {
      if (c.got || Math.abs(c.x - b.x) >= 30) continue;
      const cy = roadY(c.x) - 26 - c.lift;
      if (cy <= b.y - 52 || cy >= b.y + 8) continue;
      c.got = true;
      this.clovers++;
      b.fuel = Math.min(100, b.fuel + 25);
      this.audio.play('fuel');
      this.burst(c.x, cy, 16, '#ff6b6b', 140);
      this.burst(c.x, cy, 8, '#ffd43b', 100);
    }

    if (b.x > this.level.goal) {
      this.burst(b.x, b.y - 30, 30, '#ffd43b', 240);
      this.finish(true);
    } else if (b.fuel <= 0 && b.v < 8 && b.grounded) this.finish(false);
    this.cam += (clamp(b.x - 250, 0, this.level.length - this.view.w) - this.cam) * approach(8, dt);
  }

  finish(won) {
    super.finish(won, { cloverTotal: this.fuelBags.length, statLabel: 'Fuel bags' });
  }

  draw(g) {
    const { view, t, bike: b } = this, { w: W, h: H } = view;
    hud.sky(g, view, [[0, '#2b1055'], [0.55, '#d6457a'], [1, '#ffb26b']]);
    g.fillStyle = '#ffe29a';
    circle(g, 560, 250, 56);
    for (const [f, color, base, amp] of [[0.1, '#4a2a6e', 260, 50], [0.3, '#2c1745', 300, 40]]) {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, base - Math.abs(Math.sin((x + this.cam * f) / 150)) * amp);
      g.lineTo(W, H);
      g.fill();
    }

    g.save();
    this.applyShake(g);
    g.translate(-Math.round(this.cam), 0);
    const x0 = Math.floor(this.cam / 10) * 10, x1 = x0 + W + 20;
    const roadPath = () => { g.beginPath(); for (let x = x0; x <= x1; x += 10) x === x0 ? g.moveTo(x, roadY(x)) : g.lineTo(x, roadY(x)); };
    g.fillStyle = '#1d1220';
    g.beginPath();
    g.moveTo(x0, H);
    for (let x = x0; x <= x1; x += 10) g.lineTo(x, roadY(x) + 8);
    g.lineTo(x1, H);
    g.fill();
    g.strokeStyle = '#34303f';
    g.lineWidth = 16;
    g.lineJoin = 'round';
    roadPath();
    g.stroke();
    g.strokeStyle = '#ffd43b';
    g.lineWidth = 2;
    g.setLineDash([16, 16]);
    roadPath();
    g.stroke();
    g.setLineDash([]);

    for (const p of PUDDLES) {
      g.fillStyle = '#10202acc';
      ellipse(g, p + 40, roadY(p + 40) - 3, 40, 5);
      g.strokeStyle = '#8f5bff88';
      g.lineWidth = 1;
      g.stroke();
    }
    for (const r of RAMPS) {
      g.fillStyle = '#8d6e63';
      poly(g, r - 26, roadY(r - 26) + 2, r + 22, roadY(r + 22) - 26, r + 22, roadY(r + 22) + 2);
      g.fillStyle = '#ffd43b';
      g.fillRect(r + 10, roadY(r + 22) - 24, 10, 4);
    }
    for (const r of this.rocks) {
      if (r.hit) continue;
      const y = roadY(r.x);
      g.fillStyle = '#6c6a75';
      poly(g, r.x - 16, y, r.x - 8, y - 20, r.x + 6, y - 24, r.x + 16, y);
      g.fillStyle = '#8b8996';
      g.fillRect(r.x - 6, y - 20, 8, 4);
    }
    for (const c of this.fuelBags) if (!c.got) drawFuelBag(g, c.x, roadY(c.x) - 26 - c.lift + Math.sin(t * 4 + c.x) * 3);

    // chequered finish banner
    const gx = this.level.goal;
    g.fillStyle = '#ddd';
    g.fillRect(gx, roadY(gx) - 90, 4, 90);
    g.fillRect(gx + 80, roadY(gx + 80) - 90, 4, 90);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#111' : '#fff';
        g.fillRect(gx + 4 + i * 10, roadY(gx) - 90 + j * 10, 10, 10);
      }
    }

    this.drawRider(g, b, t);
    this.particles.draw(g);
    g.restore();

    // HUD
    g.font = '700 14px system-ui';
    g.textAlign = 'left';
    g.fillStyle = '#fff';
    g.fillText('⛽', 14, 28);
    hud.meter(g, 36, 14, 150, 16, b.fuel / 100, hud.fuelColor(b.fuel / 100, t));
    g.font = '700 14px system-ui';
    g.textAlign = 'left';
    g.fillStyle = '#fff';
    g.fillText(`🛢 ${this.clovers}/${this.fuelBags.length} · ${Math.round(b.v * 0.3)} km/h`, 14, 50);
    hud.titleBar(g, view, this.level.title, b.x / this.level.goal, { y: 24 });
    if (this.time < 6) hud.banner(g, view, 'Push joystick right = ride · left = brake · JUMP = hop. Grab the red fuel bags!');
    g.textAlign = 'left';
  }

  drawRider(g, b, t) {
    const head = clamp(axisY(this.input), -1, 1) * 5;
    g.save();
    g.translate(b.x, b.y);
    g.rotate(b.angle);
    g.fillStyle = '#0005';
    ellipse(g, 0, 2, 26, 4);
    for (const wx of [-20, 20]) { // spoked wheels
      g.save();
      g.translate(wx, -11);
      g.rotate(b.wheel);
      g.strokeStyle = '#111';
      g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.stroke();
      g.strokeStyle = '#bbb';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-9, 0); g.lineTo(9, 0);
      g.moveTo(0, -9); g.lineTo(0, 9);
      g.stroke();
      g.restore();
    }
    g.strokeStyle = '#e03131'; // frame
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-20, -11); g.lineTo(-4, -26); g.lineTo(12, -26); g.lineTo(20, -11);
    g.moveTo(-4, -26); g.lineTo(2, -11); g.lineTo(-20, -11);
    g.moveTo(12, -26); g.lineTo(16, -35);
    g.stroke();
    g.fillStyle = '#444';
    g.fillRect(-4, -20, 12, 9);
    g.strokeStyle = '#e64980'; // scarf streaming behind
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-8, -46);
    g.quadraticCurveTo(-18 - b.v * 0.05, -46 + Math.sin(t * 20) * 3, -26 - b.v * 0.08, -42 + Math.sin(t * 18) * 5);
    g.stroke();
    g.fillStyle = '#fff';
    for (const [x, y, r] of [[-6, -38, 11], [-14, -33, 9], [4, -36, 10]]) circle(g, x, y, r);
    g.strokeStyle = '#2f2938';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(6, -34); g.lineTo(15, -34); g.stroke();
    g.fillStyle = '#2f2938';
    ellipse(g, 14, -46 + head, 7, 8, 0.2);
    g.fillStyle = '#ffd43b'; // helmet + visor
    g.beginPath(); g.arc(13, -48 + head, 9, Math.PI, 0); g.fill();
    g.fillStyle = '#6ee7ff';
    g.fillRect(16, -50 + head, 5, 4);
    g.restore();
  }
}

function drawFuelBag(g, x, y) {
  g.save();
  g.translate(x, y);
  hud.glow(g, 0, 0, 36, '#ff6b6b99', 2);
  g.fillStyle = '#e03131';
  g.fillRect(-11, -14, 22, 28);
  g.fillStyle = '#a51111';
  g.fillRect(-11, 8, 22, 6);
  g.fillStyle = '#e03131';
  g.fillRect(-4, -20, 10, 6);
  g.strokeStyle = '#e03131';
  g.lineWidth = 3;
  g.beginPath(); g.arc(-2, -20, 6, Math.PI, 0); g.stroke();
  g.fillStyle = '#fff'; // fuel drop
  g.beginPath();
  g.moveTo(0, -9);
  g.quadraticCurveTo(7, 0, 0, 5);
  g.quadraticCurveTo(-7, 0, 0, -9);
  g.fill();
  g.restore();
}

