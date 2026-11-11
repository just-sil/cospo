// Infinite Mode: the screen scrolls by itself, the level is generated in chunks ahead of the
// camera, and everything far behind is thrown away. Score = metres + 10 per clover; every 250
// points the scroll speeds up by 10% (up to ×1.8). Touching the left edge hurts.

import { GROUND_Y, makePlatform, makeWolf } from '../entities.js';
import { bestLocalScore } from '../progress.js';

const BASE_SPEED = 90, SPEED_STEP = 250, MAX_STEPS = 8;
const CHECKPOINT_EVERY = 1500;
const CHUNKS = ['ground', 'ground', 'crumble', 'moving', 'lift', 'island', 'crumble', 'moving'];

export const distanceOf = x => Math.max(0, Math.floor(x / 10));
export const scoreOf = (distance, clovers) => distance + clovers * 10;
export const speedSteps = score => Math.min(MAX_STEPS, Math.floor(score / SPEED_STEP));

export class Infinite {
  constructor(game) {
    this.game = game;
    this.genX = 320;           // world x where the next chunk starts
    this.genY = GROUND_Y;      // height of the last generated surface
    this.nextCheckpoint = CHECKPOINT_EVERY;
    this.steps = 0;
    this.best = bestLocalScore();
  }

  get distance() { return distanceOf(this.game.player.x); }
  get score() { return scoreOf(this.distance, this.game.clovers); }
  get speed() { return BASE_SPEED * (1 + speedSteps(this.score) * 0.1); }

  update() {
    const game = this.game;
    const steps = speedSteps(this.score);
    if (steps > this.steps) {
      this.steps = steps;
      game.say(`⚡ SPEED UP ×${(1 + steps * 0.1).toFixed(1)} ⚡`, 1.8, '#7ee7ff');
      game.audio.play('power');
      game.shake = 6;
    }

    const difficulty = Math.min(1, this.score / 1800);
    for (let guard = 0; this.genX < game.cam + game.view.w * 1.8 && guard < 12; guard++) this.addChunk(difficulty);

    const behind = game.cam - 500;
    game.platforms = game.platforms.filter(p => p.x + p.w + p.moveX > behind);
    game.spikes = game.spikes.filter(s => s.x + s.w > behind);
    game.wolves = game.wolves.filter(w => w.max > behind);
    game.jets = game.jets.filter(j => j.x > behind);
    game.cloverItems = game.cloverItems.filter(c => c.x > behind);
    game.checkpoints = game.checkpoints.filter(c => c.x > behind);
  }

  updateCamera(dt) {
    const game = this.game, p = game.player;
    game.cam = Math.max(game.cam + this.speed * dt, p.x - game.view.w * 0.6);
    if (p.x < game.cam + 18) { // caught by the edge
      p.x = game.cam + 44;
      game.hurt();
    }
    return true;
  }

  /** Appends one random chunk of level at genX. `d` (0..1) ramps up gaps, enemies and hazards. */
  addChunk(d) {
    const game = this.game, rng = game.rng;
    const gap = () => Math.round(56 + d * 40 + rng() * 16);
    let kind = CHUNKS[Math.floor(rng() * CHUNKS.length)];
    let checkpoint = false;
    if (this.genX > this.nextCheckpoint) { // a safe ground chunk with a checkpoint every 1500 px
      kind = 'ground';
      checkpoint = true;
      this.nextCheckpoint += CHECKPOINT_EVERY;
    }
    const x = this.genX + gap();
    const add = (...args) => {
      const p = makePlatform(args);
      game.platforms.push(p);
      if (rng() < 0.7) for (let cx = p.x + 20; cx < p.x + p.w - 10; cx += 60) game.cloverItems.push({ x: cx, y: p.y - 34, got: false });
      return p;
    };

    switch (kind) {
      case 'ground': {
        const w = Math.round(270 - d * 100 + rng() * 60);
        add(x, GROUND_Y, w);
        if (checkpoint) game.checkpoints.push({ x: x + 16, y: GROUND_Y, reached: false });
        else {
          if (rng() < 0.5 + d * 0.25) game.wolves.push(makeWolf([x + w * 0.5, GROUND_Y, x + 30, x + w - 30, Math.round(105 + d * 45)]));
          if (rng() < 0.35 + d * 0.1) game.spikes.push({ x: Math.round(x + w * 0.28), y: GROUND_Y, w: 40 });
          if (rng() < 0.3 + d * 0.35) game.jets.push({ x: Math.round(x + w * 0.72), y: GROUND_Y, offset: rng() * 2.5, state: 0 });
        }
        this.genX = x + w;
        this.genY = GROUND_Y;
        break;
      }
      case 'crumble': { // three crumbling steps going up or down
        const spacing = Math.round(46 + d * 34), w = Math.round(72 - d * 14);
        let y = this.genY >= GROUND_Y ? 350 : this.genY, cx = x;
        for (let i = 0; i < 3; i++) {
          y = Math.max(260, Math.min(365, y + (rng() < 0.5 ? -30 : 30)));
          add(cx, y, w, 'c');
          cx += w + spacing;
        }
        this.genX = cx - spacing;
        this.genY = y;
        break;
      }
      case 'moving': { // a board sliding sideways across the gap
        const y = this.genY >= GROUND_Y ? 340 : this.genY, range = Math.round(90 + d * 45);
        game.platforms.push(makePlatform([x, y, 84, 'm', range, 0, +(1.1 + d * 0.5).toFixed(2), y]));
        this.genX = x + range + 84;
        this.genY = y;
        break;
      }
      case 'lift': { // a board bobbing up and down
        game.platforms.push(makePlatform([x, 300, 84, 'm', 0, Math.round(70 + d * 25), +(1.2 + d * 0.4).toFixed(2), 300]));
        this.genX = x + 84;
        this.genY = 300;
        break;
      }
      default: { // a small island with a fire jet in the middle
        const y = this.genY >= GROUND_Y ? 340 : this.genY, w = Math.round(100 - d * 25);
        add(x, y, w);
        game.jets.push({ x: Math.round(x + w / 2), y, offset: rng() * 2.5, state: 0 });
        this.genX = x + w;
        this.genY = y;
      }
    }
  }

  result() {
    return { infinite: true, score: this.score, distance: this.distance };
  }

  drawHud(g) {
    const game = this.game, { view } = game, score = this.score;
    g.textAlign = 'center';
    g.font = '800 22px system-ui';
    g.lineWidth = 4;
    g.strokeStyle = '#000a';
    g.strokeText(score + ' pts', view.w / 2, 64);
    g.fillStyle = '#fff';
    g.fillText(score + ' pts', view.w / 2, 64);
    g.font = '700 11px system-ui';
    g.fillStyle = '#ffd43b';
    g.fillText(`${this.distance} m · SPEED ×${(this.speed / BASE_SPEED).toFixed(1)} · TOP ${Math.max(this.best, score)}`, view.w / 2, 80);

    const gapToEdge = game.player.x - game.cam;
    if (gapToEdge < 130) { // red warning glow on the left edge
      const a = (130 - gapToEdge) / 130, gr = g.createLinearGradient(0, 0, 110, 0);
      gr.addColorStop(0, `rgba(255,40,40,${0.6 * a})`);
      gr.addColorStop(1, 'rgba(255,40,40,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 110, view.h);
    }
  }
}
