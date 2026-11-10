// Visual themes for the platformer levels. A theme only draws; it never changes gameplay.
//
//   night        darker HUD/clover colours, glowing barn and jets, red vignette
//   lightning    random lightning flashes (night themes only)
//   update(dt)   ambient animation (rain, snow, embers)
//   background(g, view, t, cam)   screen-space parallax scenery
//   platform(g, p, t)             one platform in world space
//   enemy(g, w, t)                one patrolling ground enemy (wolf, snowman, soldier...)

import { TAU, wrap } from './core/util.js';
import { circle, ellipse, glow, line, poly, sky } from './core/hud.js';
import { drawWolf } from './sprites.js';

const rand = Math.random; // cosmetic only

// ---------------------------------------------------------------------------------------------
// Shared pieces

function crumbleCracks(g, p, color, lineWidth = 1, inset = 0) {
  g.strokeStyle = color;
  g.lineWidth = lineWidth;
  g.beginPath();
  g.moveTo(p.x + p.w * 0.3, p.y + inset); g.lineTo(p.x + p.w * 0.4, p.y + 16);
  g.moveTo(p.x + p.w * 0.7, p.y + inset); g.lineTo(p.x + p.w * 0.6, p.y + 16);
  g.stroke();
}

/** Diagonal rain streaks; `drift` is the sideways speed in px/s. */
function rainField(view, count, drift) {
  const drops = Array.from({ length: count }, () => ({ x: rand() * view.w, y: rand() * view.h, v: 500 + rand() * 300 }));
  return {
    update(dt) {
      for (const r of drops) {
        r.y += r.v * dt;
        r.x -= drift * dt;
        if (r.y > view.h) { r.y = -10; r.x = rand() * view.w + 60; }
      }
    },
    draw(g, color, dx, dy) {
      g.strokeStyle = color;
      g.lineWidth = 1;
      for (const r of drops) line(g, r.x, r.y, r.x + dx, r.y - dy);
    },
  };
}

/** Smooth silhouette band: `shape(x)` gives the band's height at screen x. */
function band(g, view, color, shape) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, view.h);
  for (let x = 0; x <= view.w; x += 20) g.lineTo(x, shape(x));
  g.lineTo(view.w, view.h);
  g.fill();
}

// ---------------------------------------------------------------------------------------------
// Meadow (day) and Night of Fire share the classic look.

function classicTheme(view, night) {
  const clouds = Array.from({ length: 7 }, () => ({ x: rand() * 1200, y: 30 + rand() * 120, s: 0.5 + rand() }));
  const rain = night ? rainField(view, 70, 240) : null;

  return {
    night,
    lightning: night,
    update(dt) { rain?.update(dt); },
    background(g, view, t, cam) {
      if (!night) {
        sky(g, view, [[0, '#7ecbff'], [0.7, '#d9f3ff'], [1, '#fff3c4']]);
        g.fillStyle = '#fff7b0';
        circle(g, 640, 90, 38);
        g.fillStyle = '#fffc';
        for (const c of clouds) {
          const x = wrap(c.x - cam * 0.15 + t * 8 * c.s, 1300) - 200;
          g.beginPath();
          g.arc(x, c.y, 22 * c.s, 0, TAU);
          g.arc(x + 24 * c.s, c.y + 4, 18 * c.s, 0, TAU);
          g.arc(x - 22 * c.s, c.y + 5, 16 * c.s, 0, TAU);
          g.fill();
        }
        band(g, view, '#8fd68a', x => 300 + Math.sin((x + cam * 0.25) / 110) * 40);
        band(g, view, '#5fbf63', x => 340 + Math.sin((x + cam * 0.5) / 110) * 30);
        return;
      }
      sky(g, view, [[0, '#0d0614'], [0.7, '#3a1020'], [1, '#a8330f']]);
      // volcanic peaks; the nearer row has glowing lava vents
      for (const [f, color, base] of [[0.2, '#1a0b1c', 300], [0.45, '#120816', 350]]) {
        for (let i = -1; i < 22; i++) {
          const x = i * 60 - (cam * f) % 60, h = 60 + ((i + Math.floor(cam * f / 60)) * 37 % 50);
          g.fillStyle = color;
          poly(g, x, view.h, x + 30, base - h, x + 60, view.h);
          if (f > 0.3) {
            g.fillStyle = '#ff6a1a55';
            circle(g, x + 30, base - h + 12, 8 + Math.sin(t * 9 + i) * 2);
          }
        }
      }
      rain.draw(g, '#9bb8ff66', 4, 14);
    },
    platform(g, p) {
      if (p.ground) {
        g.fillStyle = night ? '#2a2030' : '#7a5230';
        g.fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle = night ? '#3b2c3d' : '#6a4526';
        for (let x = p.x + 10; x < p.x + p.w; x += 36) g.fillRect(x, p.y + 24, 18, 8);
        g.fillStyle = night ? '#4a3a4e' : '#4cb04a';
        g.fillRect(p.x, p.y, p.w, 9);
        g.fillStyle = night ? '#e8590c' : '#6ad45f';
        for (let x = p.x; x < p.x + p.w; x += 12) g.fillRect(x + 2, p.y - 3, 3, 5);
        return;
      }
      g.fillStyle = p.type === 'c' ? (night ? '#5a3a3a' : '#a8793f') : p.type === 'm' ? (night ? '#4b4f6b' : '#8d99ae') : (night ? '#4a3a4e' : '#4cb04a');
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle = night ? '#e8590c' : '#fff5';
      g.fillRect(p.x, p.y, p.w, 3);
      if (p.type === 'c') crumbleCracks(g, p, '#0006');
      if (p.type === 'm') { g.fillStyle = '#fff8'; g.fillRect(p.x + p.w / 2 - 8, p.y + 6, 16, 3); }
    },
    enemy(g, w, t) { drawWolf(g, w, t, night); },
  };
}

// ---------------------------------------------------------------------------------------------
// Haunted Harvest: moonlit graveyard with bat swarms, dead trees, fog and ghosts.

function hauntedTheme(view) {
  const base = classicTheme(view, true);
  return {
    ...base,
    update() {},
    background(g, view, t, cam) {
      sky(g, view, [[0, '#0f0620'], [0.6, '#4a1840'], [1, '#d9480f']]);
      const mx = wrap(560 - cam * 0.04, 1500) - 200;
      glow(g, mx, 100, 160, '#ffe8a366', 40);
      g.fillStyle = '#ffe8a3';
      circle(g, mx, 100, 46);
      g.fillStyle = '#e6c878';
      g.beginPath(); g.arc(mx - 12, 92, 8, 0, TAU); g.arc(mx + 14, 112, 6, 0, TAU); g.fill();

      g.fillStyle = '#0a0414';
      for (let i = 0; i < 6; i++) {
        const x = wrap(i * 260 - cam * 0.12 - t * 40 * (1 + i % 3 * 0.3), 1500) - 100, y = 50 + i * 28 + Math.sin(t * 2 + i) * 12, f = Math.sin(t * 14 + i) * 5;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x - 10, y - 8 - f, x - 18, y);
        g.quadraticCurveTo(x - 9, y + 1, x, y + 5);
        g.quadraticCurveTo(x + 9, y + 1, x + 18, y);
        g.quadraticCurveTo(x + 10, y - 8 - f, x, y);
        g.fill();
      }

      g.lineCap = 'round';
      for (const [f, color, top] of [[0.2, '#1a0a26', 310], [0.45, '#0d0517', 350]]) {
        g.strokeStyle = color;
        for (let i = -1; i < 10; i++) {
          const x = i * 170 - (cam * f) % 170 + ((i * 53) % 40);
          g.lineWidth = 7;
          line(g, x, view.h, x + 4, top);
          g.lineWidth = 3;
          for (let k = 0; k < 3; k++) line(g, x + 4, top + k * 18, x + 4 + (k % 2 ? -1 : 1) * (26 - k * 4), top - 18 + k * 12);
        }
      }

      g.fillStyle = 'rgba(190,170,230,.07)';
      for (let i = 0; i < 4; i++) ellipse(g, wrap(i * 300 - cam * 0.3 + t * 14, 1300) - 250, 380 + i * 8, 200, 22);

      for (let i = 0; i < 3; i++) {
        const x = wrap(i * 430 - cam * 0.2 + t * 12, 1400) - 150, y = 180 + i * 60 + Math.sin(t * 1.5 + i) * 15;
        g.fillStyle = 'rgba(235,230,255,.16)';
        g.beginPath();
        g.arc(x, y, 14, Math.PI, 0);
        g.lineTo(x + 14, y + 22);
        for (let k = 3; k >= -3; k--) g.lineTo(x + k * 4.6, y + 22 - (k % 2 ? 6 : 0));
        g.lineTo(x - 14, y + 22);
        g.fill();
        g.fillStyle = 'rgba(20,10,30,.4)';
        g.fillRect(x - 6, y - 3, 3, 5);
        g.fillRect(x + 3, y - 3, 3, 5);
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Frostbite Pass: snowy mountains, pine forest, falling snow, snowmen.

function frostTheme(view) {
  const flakes = Array.from({ length: 80 }, () => ({ x: rand() * 1200, y: rand() * view.h, s: 1 + rand() * 2.5, v: 30 + rand() * 50, p: rand() * 6 }));
  return {
    night: false,
    lightning: false,
    update(dt) {
      for (const f of flakes) {
        f.y += f.v * dt;
        if (f.y > view.h) { f.y = -5; f.x = rand() * view.w; }
      }
    },
    background(g, view, t, cam) {
      sky(g, view, [[0, '#7fb7e6'], [0.7, '#cfe8fa'], [1, '#e9f5ff']]);
      g.fillStyle = '#fffbd0cc';
      circle(g, 120, 80, 30);
      band(g, view, '#c3d9ee', x => 250 - Math.abs(Math.sin((x + cam * 0.1) / 130)) * 70);
      band(g, view, '#a3c1de', x => 295 - Math.abs(Math.sin((x + cam * 0.25) / 130)) * 50);
      for (const [f, color, base, k] of [[0.35, '#3d6b6a', 335, 0.8], [0.55, '#285050', 365, 1]]) {
        for (let i = -1; i < 12; i++) {
          const x = i * 110 - (cam * f) % 110 + ((i * 37) % 30);
          g.fillStyle = '#4a3a2a';
          g.fillRect(x - 3, base, 6, view.h - base);
          for (let tier = 0; tier < 3; tier++) {
            const by = base - tier * 24 * k, w = (22 - tier * 4) * k;
            g.fillStyle = color;
            poly(g, x, by - 30 * k, x + w, by, x - w, by);
            g.fillStyle = '#fff';
            poly(g, x, by - 30 * k, x + w * 0.55, by - 13 * k, x - w * 0.55, by - 13 * k);
          }
        }
      }
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (const f of flakes) circle(g, wrap(f.x + Math.sin(t + f.p) * 14 - cam * 0.5 * (f.s / 3.5), view.w), f.y, f.s);
    },
    platform(g, p) {
      if (p.ground) {
        g.fillStyle = '#7fa8cf';
        g.fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle = '#a5c8e8';
        for (let x = p.x + 8; x < p.x + p.w; x += 40) g.fillRect(x, p.y + 22, 22, 8);
        g.fillStyle = '#fff';
        g.fillRect(p.x, p.y, p.w, 12);
        g.beginPath();
        for (let x = p.x; x < p.x + p.w; x += 18) { g.moveTo(x + 18, p.y + 12); g.arc(x + 9, p.y + 12, 9, 0, Math.PI); }
        g.fill();
        return;
      }
      g.fillStyle = p.type === 'c' ? '#cfeeff' : p.type === 'm' ? '#8fb8e0' : '#a9d4f5';
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle = '#fff';
      g.fillRect(p.x - 2, p.y - 3, p.w + 4, 7);
      if (p.type === 'c') {
        g.strokeStyle = '#5f8fb8';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(p.x + p.w * 0.3, p.y + 3); g.lineTo(p.x + p.w * 0.42, p.y + 16);
        g.moveTo(p.x + p.w * 0.7, p.y + 3); g.lineTo(p.x + p.w * 0.58, p.y + 16);
        g.stroke();
      }
      g.fillStyle = '#e8f6ff';
      for (let x = p.x + 6; x < p.x + p.w - 6; x += 14) poly(g, x, p.y + p.h, x + 4, p.y + p.h + 8, x + 8, p.y + p.h);
    },
    enemy(g, w, t) { // snowman
      const b = Math.sin(t * 6 + w.x) * 2;
      g.save();
      g.translate(w.x, w.y);
      g.scale(w.dir, 1);
      g.fillStyle = '#0003';
      ellipse(g, 0, 1, 16, 4);
      g.strokeStyle = '#6b4a2a';
      g.lineWidth = 2.5;
      g.beginPath();
      g.moveTo(-9, -33); g.lineTo(-24, -42 + b * 2);
      g.moveTo(9, -33); g.lineTo(24, -40 - b * 2);
      g.stroke();
      g.fillStyle = '#fff';
      g.strokeStyle = '#9bbbd8';
      g.lineWidth = 1.5;
      for (const [x, y, rx, ry] of [[0, -13, 15, 13], [0, -33, 11, 10], [0, -48, 8, 8]]) {
        const head = y < -40;
        g.beginPath();
        g.ellipse(x + (head ? b * 0.5 : 0), y + (head ? b * 0.3 : 0), rx, ry, 0, 0, TAU);
        g.fill();
        g.stroke();
      }
      g.fillStyle = '#e03131';
      g.fillRect(-9, -41, 18, 4);
      g.fillStyle = '#222';
      g.fillRect(-7, -60, 14, 3);
      g.fillRect(-5, -68, 10, 9);
      g.fillRect(-1, -51, 3, 3);
      g.fillRect(4, -51, 3, 3);
      g.strokeStyle = '#222';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(-2, -54); g.lineTo(3, -52);
      g.moveTo(8, -54); g.lineTo(4, -52);
      g.stroke();
      g.fillStyle = '#ff922b';
      poly(g, 6, -47, 16, -45, 6, -44);
      g.fillStyle = '#222';
      g.fillRect(-1, -16, 3, 3);
      g.fillRect(-1, -12, 3, 3);
      g.restore();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Siege of Ashkar: burning sunset, castle walls, an army silhouette, catapult fireballs, embers.

function siegeTheme(view) {
  const embers = Array.from({ length: 50 }, () => ({ x: rand() * 1000, y: rand() * 450, v: 20 + rand() * 40, p: rand() * 6, s: 1 + rand() * 2 }));
  let time = 0;
  return {
    night: true,
    lightning: true,
    update(dt) {
      time += dt;
      for (const e of embers) {
        e.y -= e.v * dt;
        e.x += Math.sin(time + e.p) * 24 * dt;
        if (e.y < -5) { e.y = view.h + 5; e.x = rand() * view.w; }
      }
    },
    background(g, view, t, cam) {
      sky(g, view, [[0, '#2a0f1a'], [0.5, '#8a2c1c'], [1, '#e8872b']]);
      g.fillStyle = '#ffb347';
      circle(g, 580, 300, 70);
      g.fillStyle = '#ffd27a';
      circle(g, 580, 300, 48);
      g.fillStyle = 'rgba(30,15,20,.45)';
      for (let i = 0; i < 5; i++) {
        const x = wrap(i * 260 - cam * 0.1, 1300) - 150;
        for (let k = 0; k < 6; k++) circle(g, x + Math.sin(t * 0.6 + k + i) * 12, 300 - k * 38, 18 + k * 7);
      }
      const fx = -(cam * 0.18) % 900;
      for (let r = -1; r < 3; r++) {
        const bx = fx + r * 900;
        g.fillStyle = '#2b141a';
        g.fillRect(bx, 300, 900, 150);
        for (let tw = 0; tw < 5; tw++) {
          const x = bx + 60 + tw * 170, y = 230 - (tw % 2) * 30;
          g.fillStyle = '#2b141a';
          g.fillRect(x, y, 46, 100);
          for (let c = 0; c < 4; c++) g.fillRect(x + c * 12 - 1, y - 8, 8, 10);
          g.fillStyle = '#b02a2a';
          g.fillRect(x + 20, y - 25, 3, 25);
          g.fillRect(x + 23, y - 25, 14, 9);
        }
      }
      const ax = -(cam * 0.3) % 26;
      g.fillStyle = '#1a0a10';
      for (let x = ax - 26; x < view.w + 26; x += 26) {
        const h = ((x * 7) | 0) % 3;
        g.fillRect(x, 340 - h * 2, 7, 22);
        circle(g, x + 3.5, 336 - h * 2, 4);
        g.fillRect(x + 9, 305 - h * 4, 1.6, 50);
      }
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.35 + i * 0.33) % 1, bx = 100 + ph * 600 + i * 30, by = 330 - Math.sin(ph * Math.PI) * 210;
        g.fillStyle = 'rgba(255,140,40,.95)';
        circle(g, bx, by, 6);
        glow(g, bx, by, 26, '#ff9a3c88');
      }
      g.fillStyle = 'rgba(255,170,60,.8)';
      for (const e of embers) g.fillRect(e.x % view.w, e.y, e.s, e.s);
    },
    platform(g, p) {
      if (p.ground) {
        g.fillStyle = '#5a4a40';
        g.fillRect(p.x, p.y, p.w, p.h);
        g.strokeStyle = '#2b2220';
        g.lineWidth = 2;
        for (let y = p.y + 16, row = 0; y < p.y + p.h; y += 18, row++) {
          line(g, p.x, y, p.x + p.w, y);
          for (let x = p.x + (row % 2) * 20; x < p.x + p.w; x += 40) line(g, x, y - 18, x, y);
        }
        g.fillStyle = '#8a6a42';
        g.fillRect(p.x, p.y, p.w, 10);
        g.fillStyle = '#a8844f';
        for (let x = p.x; x < p.x + p.w; x += 14) g.fillRect(x, p.y, 2, 10);
        return;
      }
      const moving = p.type === 'm', crumbly = p.type === 'c';
      g.fillStyle = crumbly ? '#7a5a38' : moving ? '#6b4a2a' : '#8a6a42';
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle = '#caa46a';
      g.fillRect(p.x, p.y, p.w, 3);
      g.fillStyle = '#3a2a1a';
      for (let x = p.x + 10; x < p.x + p.w; x += 20) g.fillRect(x, p.y + 3, 2, p.h - 3);
      if (crumbly) crumbleCracks(g, p, '#1a0e08', 1.5);
      if (moving) {
        for (const x of [p.x + 12, p.x + p.w - 12]) {
          g.fillStyle = '#222';
          circle(g, x, p.y + p.h + 4, 7);
          g.fillStyle = '#777';
          circle(g, x, p.y + p.h + 4, 3);
        }
      }
    },
    enemy(g, w, t) { // spear soldier
      const st = Math.sin(t * 10 + w.x) * 4;
      g.save();
      g.translate(w.x, w.y);
      g.scale(w.dir, 1);
      g.fillStyle = '#0004';
      ellipse(g, 0, 1, 15, 4);
      g.fillStyle = '#3a2a1a';
      g.fillRect(-7, -12, 5, 12 + st * 0.3);
      g.fillRect(2, -12, 5, 12 - st * 0.3);
      g.fillStyle = '#b02a2a';
      g.fillRect(-10, -30, 20, 20);
      g.fillStyle = '#caa46a';
      g.fillRect(-10, -14, 20, 4);
      g.fillStyle = '#e0b48a';
      circle(g, 0, -37, 7);
      g.fillStyle = '#b8860b';
      g.beginPath(); g.arc(0, -39, 8.5, Math.PI, 0); g.fill();
      g.fillRect(-9, -39, 18, 3);
      g.fillStyle = '#c92a2a';
      g.beginPath();
      g.moveTo(-1, -47);
      g.quadraticCurveTo(-8, -58, -14, -48);
      g.quadraticCurveTo(-8, -52, -1, -45);
      g.fill();
      g.fillStyle = '#222';
      g.fillRect(3, -38, 2, 2);
      g.strokeStyle = '#6b4a2a';
      g.lineWidth = 3;
      line(g, -6, -22 + st, 26, -24);
      g.fillStyle = '#ddd';
      poly(g, 26, -27, 38, -24, 26, -21);
      g.fillStyle = '#b8860b';
      circle(g, 8, -22, 10);
      g.fillStyle = '#8a2a1a';
      circle(g, 8, -22, 6);
      g.fillStyle = '#b8860b';
      g.fillRect(6, -24, 4, 4);
      g.restore();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Neon Wolfpack: rainy night city with neon signs and searchlights.

const BUILDINGS = Array.from({ length: 60 }, (_, i) => ({
  h: 90 + ((i * 53) % 120),
  w: 46 + ((i * 29) % 40),
  windows: Array.from({ length: 40 }, () => rand() < 0.45),
  neon: i % 5 === 0 ? (i % 2 ? '#ff2d95' : '#22d3ee') : null,
}));

/** The neon wolf body, shared with the gun-wolves of the Neon feature. */
export function drawNeonWolf(g, w, t, gun = false) {
  const r = Math.sin(t * 12 + w.x) * 3, flash = (w.flash || 0) > 0;
  g.save();
  g.translate(w.x, w.y);
  g.scale(w.dir, 1);
  g.fillStyle = '#0005';
  ellipse(g, 0, 1, 16, 4);
  g.fillStyle = flash ? '#fff' : '#2d3142';
  ellipse(g, 0, -15, 17, 11);
  ellipse(g, 15, -21, 10, 8);
  poly(g, 10, -27, 12, -37, 17, -27);
  g.fillRect(-11, -9, 5, 9 + r * 0.3);
  g.fillRect(8, -9, 5, 9 - r * 0.3);
  poly(g, -15, -18, -28, -13 + r, -14, -11);
  g.fillStyle = '#ff2d55';
  g.fillRect(17, -24, 3, 3);
  g.fillStyle = gun ? '#00e5ff' : '#ff2d95';
  g.fillRect(-6, -22, 10, 3);
  if (gun) {
    g.fillStyle = '#111';
    g.fillRect(14, -16, 22, 6);
    g.fillRect(14, -12, 6, 8);
    if (w.muzzle > 0) { g.fillStyle = '#ffe066'; circle(g, 40, -13, 8); }
  }
  g.restore();
}

function neonTheme(view) {
  const rain = rainField(view, 70, 300);
  return {
    night: true,
    lightning: true,
    update(dt) { rain.update(dt); },
    background(g, view, t, cam) {
      const { w: W, h: H } = view;
      sky(g, view, [[0, '#080b1e'], [0.55, '#2a1050'], [1, '#a3206b']]);
      const mx = wrap(620 - cam * 0.03, 1500) - 200;
      const halo = g.createRadialGradient(mx, 90, 10, mx, 90, 150);
      halo.addColorStop(0, '#f5e8ffcc');
      halo.addColorStop(0.3, '#c9a7ff55');
      halo.addColorStop(1, '#0000');
      g.fillStyle = halo;
      g.fillRect(mx - 150, -60, 300, 300);
      g.fillStyle = '#fdf6ff';
      circle(g, mx, 90, 30);
      g.fillStyle = 'rgba(20,10,50,.55)';
      for (const [dx, y, rx, ry] of [[0, 70, 160, 26], [90, 100, 200, 22], [-60, 60, 150, 20]]) ellipse(g, mx + dx, y, rx, ry);

      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(180,220,255,.07)';
      for (const i of [0, 1]) {
        const a = Math.sin(t * 0.5 + i * 2.4) * 0.5, x0 = i ? W - 120 : 140, tip = x0 + Math.sin(a) * 380;
        poly(g, x0, H, tip - 26, 40, tip + 26, 40);
      }
      g.restore();

      for (const [f, color, k, near] of [[0.12, '#140d2e', 0.9, false], [0.28, '#0d0820', 1.25, true]]) {
        const spacing = 70 * k;
        for (let i = -1; i < W / spacing + 3; i++) {
          const idx = wrap(Math.floor((cam * f) / spacing) + i, 60), b = BUILDINGS[idx];
          const x = i * spacing - (cam * f) % spacing, h = b.h * k + (near ? 40 : 0), bw = b.w * k;
          g.fillStyle = color;
          g.fillRect(x, H - h - 60, bw, h + 60);
          if (near && b.neon) {
            g.save();
            g.globalCompositeOperation = 'lighter';
            g.fillStyle = b.neon;
            g.globalAlpha = 0.8 * (Math.sin(t * 8 + idx) > -0.85 ? 1 : 0.3); // flickering sign
            g.fillRect(x + 4, H - h - 38, bw - 8, 10);
            const gl = g.createRadialGradient(x + bw / 2, H - h - 33, 2, x + bw / 2, H - h - 33, 60);
            gl.addColorStop(0, b.neon + '66');
            gl.addColorStop(1, '#0000');
            g.fillStyle = gl;
            g.fillRect(x - 30, H - h - 100, bw + 60, 120);
            g.restore();
          }
          g.fillStyle = near ? 'rgba(255,220,120,.55)' : 'rgba(255,200,120,.25)';
          for (let r = 0; r < 8; r++) {
            for (let q = 0; q < 4; q++) {
              if (b.windows[(r * 4 + q) % 40]) g.fillRect(x + 6 + q * 10 * k, H - h - 48 + r * 14 * k + 12, 5 * k, 7 * k);
            }
          }
        }
      }
      rain.draw(g, 'rgba(170,200,255,.35)', 5, 16);
      g.fillStyle = 'rgba(200,170,255,.06)';
      for (let i = 0; i < 3; i++) ellipse(g, wrap(i * 330 - cam * 0.35 + t * 10, 1100) - 150, 410, 220, 26);
    },
    platform(g, p) {
      if (p.ground) {
        g.fillStyle = '#161a30';
        g.fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle = '#1f2542';
        for (let x = p.x + 6; x < p.x + p.w - 6; x += 34) g.fillRect(x, p.y + 18, 24, 10);
        g.strokeStyle = '#0a0d1c';
        g.lineWidth = 2;
        for (let x = p.x; x < p.x + p.w; x += 60) line(g, x, p.y, x, p.y + p.h);
        g.fillStyle = '#22d3ee';
        g.fillRect(p.x, p.y, p.w, 3);
        g.save();
        g.globalCompositeOperation = 'lighter';
        const gl = g.createLinearGradient(0, p.y - 12, 0, p.y + 8);
        gl.addColorStop(0, '#0000');
        gl.addColorStop(0.6, '#22d3ee55');
        gl.addColorStop(1, '#0000');
        g.fillStyle = gl;
        g.fillRect(p.x, p.y - 12, p.w, 20);
        g.restore();
        return;
      }
      const crumbly = p.type === 'c', moving = p.type === 'm';
      g.fillStyle = crumbly ? '#3a2a22' : '#232a4a';
      g.fillRect(p.x, p.y, p.w, p.h);
      if (crumbly) { // hazard stripes
        g.fillStyle = '#ffb020';
        for (let x = p.x; x < p.x + p.w; x += 16) poly(g, x, p.y + p.h, x + 8, p.y + p.h, x + 16, p.y, x + 8, p.y);
        g.fillStyle = '#3a2a22cc';
        g.fillRect(p.x, p.y, p.w, p.h);
      }
      g.fillStyle = moving ? '#ff2d95' : crumbly ? '#ffb020' : '#22d3ee';
      g.fillRect(p.x, p.y, p.w, 3);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = (moving ? '#ff2d95' : '#22d3ee') + '33';
      g.fillRect(p.x, p.y + p.h, p.w, 6);
      g.restore();
      if (crumbly) crumbleCracks(g, p, '#000a', 1.5);
    },
    enemy(g, w, t) { drawNeonWolf(g, w, t, false); },
  };
}

// ---------------------------------------------------------------------------------------------
// Sky Kingdom: sunrise above the clouds, rainbow, floating islands, balloons, birds.

const SKY_CLOUDS = Array.from({ length: 30 }, (_, i) => ({ y: 60 + ((i * 47) % 230), s: 0.6 + ((i * 31) % 10) / 10, x: (i * 173) % 1400 }));

function skyTheme() {
  const puff = (g, x, y, s, alpha) => {
    g.fillStyle = `rgba(255,255,255,${alpha})`;
    g.beginPath();
    g.arc(x, y, 24 * s, 0, TAU);
    g.arc(x + 26 * s, y + 4 * s, 20 * s, 0, TAU);
    g.arc(x - 26 * s, y + 5 * s, 18 * s, 0, TAU);
    g.arc(x + 8 * s, y - 12 * s, 18 * s, 0, TAU);
    g.fill();
  };
  return {
    night: false,
    lightning: false,
    update() {},
    background(g, view, t, cam) {
      const { w: W, h: H } = view;
      sky(g, view, [[0, '#3a7bd5'], [0.45, '#8ec5ff'], [0.8, '#ffd9a0'], [1, '#ffb36b']]);
      const sx = W * 0.72, sy = 150;
      g.save();
      g.translate(sx, sy);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(255,236,170,.08)';
      for (let i = 0; i < 12; i++) {
        g.rotate(TAU / 12 + Math.sin(t * 0.2) * 0.002);
        poly(g, 0, 0, -18, -400, 18, -400);
      }
      g.restore();
      const sun = g.createRadialGradient(sx, sy, 10, sx, sy, 120);
      sun.addColorStop(0, '#fffbe0');
      sun.addColorStop(0.3, '#ffe27a');
      sun.addColorStop(1, '#ffe27a00');
      g.fillStyle = sun;
      g.fillRect(sx - 120, sy - 120, 240, 240);

      const rx = wrap(300 - cam * 0.06, 1400) - 200;
      g.lineWidth = 7;
      ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'].forEach((c, i) => {
        g.strokeStyle = c + '66';
        g.beginPath();
        g.arc(rx + 250, 380, 230 - i * 7, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      });

      SKY_CLOUDS.forEach((c, i) => {
        const f = 0.06 + (i % 3) * 0.06, x = wrap(c.x - cam * f + t * (4 + i % 4 * 2), 1500) - 150;
        puff(g, x, c.y, c.s * (1 + (i % 3) * 0.2), 0.55 + (i % 3) * 0.12);
      });

      [[0.2, '#6fb36b', 0.7], [0.35, '#4d9a55', 1]].forEach(([f, color, k], li) => {
        for (let i = 0; i < 4; i++) {
          const x = wrap(i * 330 + li * 140 - cam * f, 1400) - 200, y = 250 + Math.sin(t * 0.6 + i + li) * 8 + li * 40;
          g.fillStyle = '#8a6a52';
          poly(g, x - 50 * k, y, x + 50 * k, y, x + 14 * k, y + 50 * k, x - 14 * k, y + 40 * k);
          g.fillStyle = color;
          ellipse(g, x, y, 52 * k, 14 * k);
          g.fillStyle = '#2f7d46';
          for (let tr = -1; tr <= 1; tr++) poly(g, x + tr * 22 * k, y - 26 * k, x + tr * 22 * k + 9 * k, y - 4 * k, x + tr * 22 * k - 9 * k, y - 4 * k);
        }
      });

      for (let i = 0; i < 2; i++) {
        const x = wrap(i * 520 + 200 - cam * 0.12 + t * 6, 1500) - 150, y = 110 + i * 60 + Math.sin(t * 0.8 + i) * 10;
        g.fillStyle = i ? '#ff6b6b' : '#4dabf7';
        ellipse(g, x, y, 17, 21);
        g.fillStyle = '#fff8';
        g.fillRect(x - 3, y - 21, 6, 42);
        g.fillStyle = '#6b4a2a';
        g.fillRect(x - 6, y + 27, 12, 8);
        g.strokeStyle = '#6b4a2a';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - 10, y + 16); g.lineTo(x - 6, y + 27);
        g.moveTo(x + 10, y + 16); g.lineTo(x + 6, y + 27);
        g.stroke();
      }

      g.strokeStyle = '#445';
      g.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const x = wrap(i * 140 - cam * 0.2 - t * 30, 1000) - 100, y = 70 + i * 18 + Math.sin(t * 3 + i) * 5, f = Math.sin(t * 10 + i) * 4;
        g.beginPath();
        g.moveTo(x - 8, y - f);
        g.quadraticCurveTo(x - 4, y - 4, x, y);
        g.quadraticCurveTo(x + 4, y - 4, x + 8, y - f);
        g.stroke();
      }
      for (let i = 0; i < 14; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(t * 3 + i) * 0.25})`;
        g.fillRect(wrap(i * 91 - cam * 0.4 + t * 10, W), (i * 53 + t * 12) % H, 2, 2);
      }
    },
    platform(g, p, t) {
      const crumbly = p.type === 'c', moving = p.type === 'm', storm = p.type === 'g';
      if (p.ground) {
        g.fillStyle = '#dfe6ff';
        g.fillRect(p.x, p.y + 10, p.w, p.h - 10);
        const gl = g.createLinearGradient(0, p.y, 0, p.y + p.h);
        gl.addColorStop(0, storm ? '#8a93aa' : '#ffffff');
        gl.addColorStop(1, storm ? '#4f5872' : '#b9c6f0');
        g.fillStyle = gl;
        g.fillRect(p.x, p.y + 6, p.w, p.h - 6);
        g.fillStyle = storm ? '#8a93aa' : '#fff';
        for (let x = p.x; x < p.x + p.w + 10; x += 26) circle(g, Math.min(x + 8, p.x + p.w - 6), p.y + 4, 13 + ((x * 7) % 5));
        g.fillStyle = storm ? '#9fb0ff' : '#ffe27a';
        g.fillRect(p.x, p.y, p.w, 3);
        g.fillStyle = storm ? '#3a4258aa' : '#b9c6f0aa';
        for (let x = p.x + 14; x < p.x + p.w - 14; x += 44) ellipse(g, x, p.y + 34, 16, 8);
      } else {
        g.fillStyle = storm ? '#6f788f' : crumbly ? '#e8d8b0' : '#ffffff';
        g.beginPath();
        if (g.roundRect) g.roundRect(p.x, p.y, p.w, p.h + 2, 8); else g.rect(p.x, p.y, p.w, p.h + 2);
        g.fill();
        g.beginPath();
        g.arc(p.x + p.w * 0.28, p.y + 2, 10, 0, TAU);
        g.arc(p.x + p.w * 0.6, p.y, 12, 0, TAU);
        g.arc(p.x + p.w * 0.85, p.y + 3, 9, 0, TAU);
        g.fill();
        g.fillStyle = storm ? '#4a5368' : crumbly ? '#cdb98a' : '#dfe6ff';
        g.fillRect(p.x + 4, p.y + p.h - 4, p.w - 8, 5);
        g.fillStyle = moving ? '#ffd43b' : storm ? '#9fb0ff' : crumbly ? '#b09a66' : '#ffe27a';
        g.fillRect(p.x + 2, p.y + 1, p.w - 4, 2.5);
        if (crumbly) {
          g.strokeStyle = '#ffd43b';
          g.lineWidth = 2;
          line(g, p.x + p.w * 0.4, p.y + 2, p.x + p.w * 0.5, p.y + 8, p.x + p.w * 0.44, p.y + 9, p.x + p.w * 0.55, p.y + 16);
        }
        if (moving) {
          g.fillStyle = '#ffd43b';
          for (let i = 0; i < 3; i++) {
            const a = t * 3 + i * 2.1;
            g.fillRect(p.x + p.w / 2 + Math.cos(a) * p.w * 0.35, p.y + 8 + Math.sin(a) * 4, 2, 2);
          }
        }
      }
      if (storm && Math.sin(t * 9 + p.x) > 0.8) { // little spark under storm boards
        g.strokeStyle = '#dfe6ff';
        g.lineWidth = 1.5;
        line(g, p.x + p.w * 0.5, p.y + p.h, p.x + p.w * 0.44, p.y + p.h + 8, p.x + p.w * 0.54, p.y + p.h + 15);
      }
    },
    enemy(g, w, t) { // aviator wolf with goggles and scarf
      const r = Math.sin(t * 11 + w.x) * 3;
      g.save();
      g.translate(w.x, w.y);
      g.scale(w.dir, 1);
      g.fillStyle = '#0003';
      ellipse(g, 0, 1, 16, 4);
      g.fillStyle = '#6a5a8e';
      ellipse(g, 0, -15, 17, 11);
      ellipse(g, 15, -21, 10, 8);
      poly(g, 10, -27, 12, -37, 17, -27);
      g.fillRect(-11, -9, 5, 9 + r * 0.3);
      g.fillRect(8, -9, 5, 9 - r * 0.3);
      poly(g, -15, -18, -28, -13 + r, -14, -11);
      g.fillStyle = '#e8d9ff';
      ellipse(g, 10, -13, 7, 5);
      g.fillStyle = '#ffd43b';
      g.fillRect(12, -26, 9, 6);
      g.fillStyle = '#222';
      g.fillRect(15, -25, 3, 4);
      g.strokeStyle = '#e03131';
      g.lineWidth = 3;
      line(g, 5, -24, -7, -21 + r * 0.3);
      g.restore();
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Crystal Depths: a dark cavern with glowing crystal clusters and light shafts.

const CRYSTALS = Array.from({ length: 40 }, (_, i) => ({ x: (i * 137) % 1500, s: 0.6 + ((i * 53) % 10) / 10, color: ['#22d3ee', '#c084fc', '#4ade80', '#f472b6'][i % 4] }));

function crystalTheme(view) {
  const base = classicTheme(view, true);
  return {
    night: true,
    lightning: false, // underground: no sky
    update() {},
    enemy: base.enemy,
    background(g, view, t, cam) {
      const { w: W, h: H } = view;
      sky(g, view, [[0, '#0a0f24'], [0.6, '#13213f'], [1, '#0b3a4a']]);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(110,231,255,.05)';
      for (let i = 0; i < 3; i++) {
        const x = wrap(i * 330 - cam * 0.1, 1100) - 100;
        poly(g, x, 0, x + 60, 0, x + 170, H, x - 60, H);
      }
      g.restore();
      for (const [f, color, k] of [[0.12, '#101a38', 0.8], [0.3, '#0b1229', 1.15]]) {
        g.fillStyle = color;
        const spacing = 90 * k;
        for (let i = -1; i < W / spacing + 2; i++) {
          const idx = Math.floor((cam * f) / spacing) + i, x = i * spacing - (cam * f) % spacing;
          const h = (40 + wrap(idx, 7) * 18) * k, h2 = (30 + wrap(idx * 3, 5) * 22) * k;
          poly(g, x, 0, x + spacing * 0.7, 0, x + spacing * 0.35, h);
          poly(g, x + 10, H, x + spacing * 0.8, H, x + spacing * 0.45, H - h2);
        }
      }
      CRYSTALS.forEach((c, i) => {
        const f = 0.2 + (i % 3) * 0.1, x = wrap(c.x - cam * f, 1500) - 100, y = H - 70 - (i % 4) * 28 - ((i * 7) % 30);
        g.save();
        g.globalCompositeOperation = 'lighter';
        const gl = g.createRadialGradient(x, y, 2, x, y, 50 * c.s);
        gl.addColorStop(0, c.color + '88');
        gl.addColorStop(1, c.color + '00');
        g.fillStyle = gl;
        g.fillRect(x - 60, y - 60, 120, 120);
        g.restore();
        g.fillStyle = c.color;
        for (let k = -1; k <= 1; k++) poly(g, x + k * 8, y + 10, x + k * 8, y - 14 * c.s - (k ? 0 : 8), x + k * 8 + 5 * c.s, y + 10);
      });
      for (let i = 0; i < 30; i++) {
        g.fillStyle = `rgba(160,255,240,${0.25 + Math.sin(t * 2 + i) * 0.2})`;
        g.fillRect(wrap(i * 91 - cam * 0.25 + Math.sin(t * 0.5 + i) * 20, W), wrap(i * 53 - t * 14, H), 2, 2);
      }
    },
    platform(g, p) {
      const crumbly = p.type === 'c', moving = p.type === 'm';
      if (p.ground) {
        g.fillStyle = '#1d1b34';
        g.fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle = '#2a2748';
        for (let x = p.x + 6; x < p.x + p.w - 6; x += 38) g.fillRect(x, p.y + 20, 26, 12);
        g.fillStyle = '#6ee7ff';
        g.fillRect(p.x, p.y, p.w, 3);
        for (let x = p.x + 12; x < p.x + p.w - 6; x += 46) {
          g.fillStyle = ((x / 46 | 0) % 2) ? '#c084fc' : '#6ee7ff';
          poly(g, x - 4, p.y, x, p.y - (8 + ((x * 7) % 9)), x + 4, p.y);
        }
        g.save();
        g.globalCompositeOperation = 'lighter';
        const gl = g.createLinearGradient(0, p.y - 14, 0, p.y + 8);
        gl.addColorStop(0, '#0000');
        gl.addColorStop(0.7, '#6ee7ff44');
        gl.addColorStop(1, '#0000');
        g.fillStyle = gl;
        g.fillRect(p.x, p.y - 14, p.w, 22);
        g.restore();
        return;
      }
      g.fillStyle = crumbly ? '#7c5a24' : moving ? '#4c2f7a' : '#2f4a8a';
      poly(g, p.x + 6, p.y, p.x + p.w - 6, p.y, p.x + p.w, p.y + p.h, p.x, p.y + p.h);
      g.fillStyle = crumbly ? '#ffb84d' : moving ? '#e0aaff' : '#a5f3fc';
      g.fillRect(p.x + 4, p.y, p.w - 8, 3);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = (crumbly ? '#ffb84d' : moving ? '#c084fc' : '#6ee7ff') + '44';
      g.fillRect(p.x, p.y + p.h, p.w, 7);
      g.restore();
      if (crumbly) crumbleCracks(g, p, '#000a', 1.5);
    },
  };
}

const THEMES = {
  meadow: view => classicTheme(view, false),
  fire: view => classicTheme(view, true),
  haunted: hauntedTheme,
  frost: frostTheme,
  siege: siegeTheme,
  neon: neonTheme,
  sky: skyTheme,
  crystal: crystalTheme,
};

export function createTheme(name, view) {
  const make = THEMES[name];
  if (!make) throw new Error(`Unknown theme "${name}"`);
  return make(view);
}

export const THEME_NAMES = Object.keys(THEMES);
