// The side-scrolling platformer used by eight levels and Infinite Mode.
//
// The core handles running, jumping, platforms, spikes, fire jets, clovers, checkpoints and
// patrolling enemies. Anything level-specific (bats, archers, guns, capes, the endless generator...)
// lives in a "feature" (see features/index.js) that plugs into the hooks called below.

import { approach, clamp, seededRandom } from '../core/util.js';
import { axisX, axisY } from '../core/input.js';
import { Mode } from './mode.js';
import * as hud from '../core/hud.js';
import { createTheme } from '../themes.js';
import { FEATURES } from '../features/index.js';
import { GROUND_Y, makePlatform, makeWolf } from '../entities.js';
import { drawBarn, drawCheckpoint, drawClover, drawJet, drawJetGlow, drawSheep, drawSpikes } from '../sprites.js';

/** Movement tuning, in pixels and seconds. */
export const PHYSICS = {
  runSpeed: 210,
  accelGround: 14,       // how quickly vx reaches the target speed on the ground…
  accelAir: 7,           // …and in the air
  gravity: 1500,
  maxFall: 760,
  jumpSpeed: 520,
  doubleJumpSpeed: 470,
  jumpCut: 900,          // extra gravity while rising with the jump button released (short hops)
  coyoteTime: 0.1,       // you can still jump this long after walking off a ledge
  jumpBuffer: 0.12,      // a jump pressed this long before landing still counts
  stompBounce: 430,
  hurtInvuln: 1.3,
  respawnInvuln: 1.2,
  deathY: 520,           // falling below this line loses the sheep
  crumbleDelay: 0.55,    // crumbling boards fall this long after being stepped on…
  crumbleRespawn: 2.6,   // …and come back after this long
  jetCycle: 2.6,         // fire jets: off for 1.3 s, sputter until 1.8 s, then blast
};

const DEFAULT_RULES = { fallCostsHeart: true, wolvesChase: true, checkpointHeal: 0, cloverSpacing: 70 };

export class Platformer extends Mode {
  /**
   * @param {object} level  an entry from levels.js
   * @param {object} env    { input, view, audio?, rng? }
   */
  constructor(level, env) {
    super(level, env);
    this.rules = { ...DEFAULT_RULES, ...level.rules };
    this.theme = createTheme(level.theme, this.view);
    this.flash = 0;          // lightning flash on stormy night levels
    this.message = { text: '', time: 0, color: '#fff' };
    this.hearts = this.maxHearts = level.hearts;

    const w = level.world;
    this.platforms = w.platforms.map(makePlatform);
    this.spikes = (w.spikes || []).map(([x, y, width]) => ({ x, y, w: width }));
    this.wolves = (w.wolves || []).map(makeWolf);
    this.jets = (w.jets || []).map(([x, y, offset]) => ({ x, y, offset, state: 0 }));
    this.checkpoints = (w.checkpoints || []).map(([x, y]) => ({ x, y, reached: false }));
    this.cloverItems = [];
    const cloverRng = seededRandom(1000 + level.index); // same clovers on every attempt
    for (const p of w.platforms) this.addClovers(p[0], p[1], p[2], p[3], cloverRng);

    this.player = {
      x: 40, y: GROUND_Y, vx: 0, vy: 0, face: 1, squash: 0,
      grounded: false, on: null, coyote: 0, jumpBuffer: 0, canDoubleJump: false,
      invuln: 0, superTime: 0, respawnX: 40, respawnY: GROUND_Y,
    };

    this.features = (level.features || []).map(name => new FEATURES[name](this));
  }

  /** Clovers along a platform (never on moving ones). About 80% of the slots get one. */
  addClovers(x, y, w, type, rng = this.rng) {
    if (type === 'm') return;
    for (let cx = x + 30; cx < x + w - 15; cx += this.rules.cloverSpacing) {
      if (rng() < 0.8) this.cloverItems.push({ x: cx, y: y - 34, got: false });
    }
  }

  get controls() { return { jump: true, fire: this.features.some(f => f.usesFire) }; }

  press(action) {
    if (action === 'jump' && this.playing) this.player.jumpBuffer = PHYSICS.jumpBuffer;
  }

  say(text, time, color = '#ffd43b') { this.message = { text, time, color }; }
  /** Bounce off something the sheep just stomped. */
  bounce() { this.player.vy = -PHYSICS.stompBounce; this.player.canDoubleJump = true; }
  /** Is a world x inside the visible screen (plus a margin)? */
  onScreen(x, margin = 0) { return x > this.cam - margin && x < this.cam + this.view.w + margin; }

  // -------------------------------------------------------------------------------------------
  // Simulation

  update(dt) {
    this.flash = Math.max(0, this.flash - dt);
    if (this.message.time > 0) this.message.time -= dt;
    this.theme.update(dt);
    if (this.theme.lightning && Math.random() < 0.004) this.flash = 0.25;
    if (!this.tick(dt)) return;

    this.updatePlatforms(dt);
    const prevY = this.updatePlayer(dt);
    this.updateHazards(dt, prevY);
    if (!this.playing) return;
    for (const f of this.features) {
      f.update?.(dt, prevY);
      if (!this.playing) return;
    }
    if (this.player.x > this.level.goal) {
      this.burst(this.player.x, this.player.y - 20, 30, '#ffd43b', 220);
      this.finish(true);
      return;
    }
    if (!this.features.some(f => f.updateCamera?.(dt))) {
      const target = clamp(this.player.x - 300, 0, this.level.length - this.view.w + 40);
      this.cam += (target - this.cam) * approach(8, dt);
    }
  }

  updatePlatforms(dt) {
    for (const p of this.platforms) {
      if (p.type === 'm') {
        const ox = p.x, oy = p.y, wave = Math.sin(this.t * p.speed);
        p.x = p.originX + p.moveX * (0.5 + 0.5 * wave);
        p.y = p.baseY + p.moveY * wave;
        p.dx = p.x - ox;
        p.dy = p.y - oy;
      } else if (p.type === 'c') {
        if (p.crumbleTimer > 0) {
          p.crumbleTimer -= dt;
          if (p.crumbleTimer <= 0) { p.fallen = true; p.respawnTimer = PHYSICS.crumbleRespawn; }
        }
        if (p.fallen && (p.respawnTimer -= dt) <= 0) {
          p.fallen = false;
          p.crumbleTimer = 0; // re-arm, so the board crumbles again next time
        }
      }
    }
  }

  /** Moves the sheep and lands it on platforms. Returns its y before this step. */
  updatePlayer(dt) {
    const p = this.player, P = PHYSICS;
    const target = axisX(this.input) * P.runSpeed;
    if (target) p.face = target > 0 ? 1 : -1;
    if (p.on) { p.x += p.on.dx; p.y += p.on.dy; } // ride moving platforms

    p.vx += (target - p.vx) * approach(p.grounded ? P.accelGround : P.accelAir, dt);
    p.vy = Math.min(P.maxFall, p.vy + P.gravity * dt);
    p.coyote = p.grounded ? P.coyoteTime : p.coyote - dt;
    p.jumpBuffer -= dt;
    p.invuln = Math.max(0, p.invuln - dt);
    p.squash *= Math.pow(0.001, dt);

    if (p.jumpBuffer > 0) {
      if (p.coyote > 0) {
        p.vy = -P.jumpSpeed;
        p.coyote = p.jumpBuffer = 0;
        p.canDoubleJump = true;
        p.squash = -0.15;
        this.burst(p.x, p.y, 5, '#fff', 60);
        this.audio.play('jump');
      } else if (p.canDoubleJump) {
        p.vy = -P.doubleJumpSpeed;
        p.canDoubleJump = false;
        p.jumpBuffer = 0;
        p.squash = -0.15;
        this.burst(p.x, p.y, 8, '#bfe7ff', 90);
        this.audio.play('doubleJump');
      }
    }
    if (!this.input.jump && p.vy < -200 && !p.grounded) p.vy += P.jumpCut * dt;
    for (const f of this.features) f.steerPlayer?.(dt, target);

    p.x = clamp(p.x + p.vx * dt, 12, this.level.length);
    const prevY = p.y;
    p.y += p.vy * dt;
    p.grounded = false;
    p.on = null;
    if (p.vy >= 0) {
      for (const pl of this.platforms) {
        if (pl.fallen || p.x + 8 <= pl.x || p.x - 8 >= pl.x + pl.w || prevY > pl.y + 12 || p.y < pl.y) continue;
        p.y = pl.y;
        if (p.vy > 200) p.squash = 0.2;
        p.vy = 0;
        p.grounded = true;
        p.canDoubleJump = true;
        p.on = pl;
        if (pl.type === 'c' && !pl.crumbleTimer) pl.crumbleTimer = P.crumbleDelay;
        break;
      }
    }
    return prevY;
  }

  updateHazards(dt, prevY) {
    const p = this.player;
    if (p.y > PHYSICS.deathY) this.fall();

    for (const c of this.cloverItems) {
      if (c.got || Math.abs(c.x - p.x) >= 16 || Math.abs(c.y - (p.y - 14)) >= 22) continue;
      c.got = true;
      this.clovers++;
      this.audio.play('coin');
      this.burst(c.x, c.y, 6, '#69db7c', 80);
    }

    for (const c of this.checkpoints) {
      if (c.reached || p.x <= c.x) continue;
      c.reached = true;
      p.respawnX = c.x + 10;
      p.respawnY = c.y;
      this.burst(c.x, c.y - 30, 16, '#ffd43b');
      this.audio.play('checkpoint');
      const heal = this.rules.checkpointHeal;
      this.hearts = heal === 'full' ? this.maxHearts : Math.min(this.maxHearts, this.hearts + heal);
      for (const f of this.features) f.onCheckpoint?.();
    }

    for (const s of this.spikes) {
      if (p.x + 8 > s.x && p.x - 8 < s.x + s.w && p.y > s.y - 14 && p.y - 20 < s.y) this.hurt();
    }

    for (const j of this.jets) {
      const phase = (this.t + j.offset) % PHYSICS.jetCycle;
      j.state = phase < 1.3 ? 0 : phase < 1.8 ? 1 : 2;
      if (j.state === 2 && Math.abs(p.x - j.x) < 20 && p.y > j.y - 100 && p.y - 24 < j.y) this.hurt();
    }

    for (const w of this.wolves) {
      if (w.dead) continue;
      let speed = w.speed;
      if (this.rules.wolvesChase && Math.abs(p.x - w.x) < 170 && Math.abs(p.y - w.y) < 50) {
        w.dir = p.x > w.x ? 1 : -1;
        speed *= 1.35;
      }
      w.x += w.dir * speed * dt;
      if (w.x < w.min) { w.x = w.min; w.dir = 1; }
      if (w.x > w.max) { w.x = w.max; w.dir = -1; }
      if (Math.abs(p.x - w.x) < 20 && p.y > w.y - 26 && p.y - 22 < w.y) {
        if (p.vy > 0 && p.y >= prevY && prevY < w.y - 14) this.stomp(w);
        else this.hurt();
      }
    }
  }

  stomp(w) {
    w.dead = true;
    this.audio.play('stomp');
    for (const f of this.features) f.onStomp?.(w);
    this.bounce();
    this.burst(w.x, w.y - 12, 14, '#aaa');
    this.shake = 5;
  }

  /** Take a hit (spikes, enemies, projectiles). Brief invulnerability afterwards. */
  hurt() {
    const p = this.player;
    if (p.invuln > 0 || !this.playing) return;
    if (this.features.some(f => f.absorbHit?.())) return;
    this.hearts--;
    p.invuln = PHYSICS.hurtInvuln;
    this.audio.play('hurt');
    p.vy = -330;
    p.vx = -p.face * 200;
    this.shake = 8;
    this.burst(p.x, p.y - 14, 12, '#ff6b6b');
    if (this.hearts <= 0) this.finish(false);
  }

  /** Fell into a gap: back to the last checkpoint (costing a heart on most levels). */
  fall() {
    const p = this.player;
    this.audio.play('fall');
    if (this.rules.fallCostsHeart && --this.hearts <= 0) { this.finish(false); return; }
    p.x = p.respawnX;
    p.y = p.respawnY - 2;
    p.vx = p.vy = 0;
    p.invuln = PHYSICS.respawnInvuln;
    this.shake = 6;
    this.burst(p.x, p.y - 14, 12, '#fff');
  }

  finish(won) {
    const extra = { cloverTotal: this.cloverItems.length, hearts: this.hearts, statLabel: 'Clovers' };
    for (const f of this.features) Object.assign(extra, f.result?.());
    super.finish(won, extra);
  }

  // -------------------------------------------------------------------------------------------
  // Rendering

  draw(g) {
    const { view, theme, t, player: p } = this, night = theme.night;
    theme.background(g, view, t, this.cam);

    g.save();
    this.applyShake(g);
    g.translate(-Math.round(this.cam), 0);
    const visible = (x0, x1 = x0) => x1 > this.cam - 120 && x0 < this.cam + view.w + 120;

    if (visible(this.level.goal - 80, this.level.goal + 150)) drawBarn(g, this.level.goal, night);
    for (const pl of this.platforms) {
      if (pl.fallen || !visible(pl.x, pl.x + pl.w)) continue;
      g.save();
      if (pl.crumbleTimer > 0) g.translate(Math.sin(t * 60) * 1.5, 0); // about to fall: shake
      theme.platform(g, pl, t);
      g.restore();
    }
    for (const c of this.checkpoints) if (visible(c.x)) drawCheckpoint(g, c);
    for (const s of this.spikes) if (visible(s.x, s.x + s.w)) drawSpikes(g, s);
    for (const j of this.jets) if (visible(j.x)) drawJet(g, j, t);
    for (const c of this.cloverItems) if (!c.got && visible(c.x)) drawClover(g, c, t, night);
    for (const w of this.wolves) if (!w.dead && visible(w.x)) theme.enemy(g, w, t);
    for (const f of this.features) f.drawWorld?.(g);

    drawSheep(g, p, t, {
      headTilt: axisY(this.input),
      blink: p.invuln > 0 && p.superTime <= 0 && Math.floor(t * 20) % 2 === 1,
      gear: g2 => { for (const f of this.features) f.drawGear?.(g2); },
    });
    this.particles.draw(g);
    if (night) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const j of this.jets) if (visible(j.x)) drawJetGlow(g, j);
      g.restore();
    }
    g.restore();

    if (night) {
      if (this.flash > 0) {
        g.fillStyle = `rgba(200,220,255,${this.flash * 1.6})`;
        g.fillRect(0, 0, view.w, view.h);
      }
      const v = g.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.4, view.w / 2, view.h / 2, view.h);
      v.addColorStop(0, '#0000');
      v.addColorStop(1, '#300000aa');
      g.fillStyle = v;
      g.fillRect(0, 0, view.w, view.h);
    }
    this.drawHud(g);
  }

  drawHud(g) {
    const { view, level } = this, textColor = this.theme.night ? '#fff' : '#1b2b1b';
    hud.hearts(g, this.hearts, this.maxHearts);
    g.font = '700 14px system-ui';
    g.textAlign = 'left';
    g.fillStyle = textColor;
    g.fillText(level.infinite ? `🍀 ${this.clovers}` : `🍀 ${this.clovers}/${this.cloverItems.length}`, 22 + this.maxHearts * 26, 28);
    hud.titleBar(g, view, level.title, this.player.x / level.goal, { color: textColor, showProgress: !level.infinite });
    for (const f of this.features) f.drawHud?.(g);
    hud.callout(g, view, this.message.text, this.message.time, this.message.color);
    if (level.tip && this.time < 6) hud.banner(g, view, level.tip);
    g.textAlign = 'left';
  }
}
