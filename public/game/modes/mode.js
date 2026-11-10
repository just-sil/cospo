// Shared plumbing for every game mode (platformer, highway, space).
//
// A mode is created per attempt and driven by the game loop:
//   start()          begin playing (until then the scene is frozen behind the intro screen)
//   press(action)    one-shot input: 'jump' or 'nitro'
//   update(dt)       fixed 1/60 s steps
//   draw(g)          render one frame on a 2D canvas context
//   controls         which touch buttons to show: { jump, fire, nitro }
//   onEnd(result)    set by the game; called once with { won, clovers, cloverTotal, ... }

import { silentAudio } from '../core/audio.js';
import { Particles } from '../core/particles.js';

export class Mode {
  constructor(level, { input, view, audio = silentAudio, rng = Math.random }) {
    this.level = level;
    this.input = input;
    this.view = view;
    this.audio = audio;
    this.rng = rng;               // gameplay randomness (injectable for tests)
    this.particles = new Particles();
    this.onEnd = null;
    this.status = 'ready';        // ready → playing → won | lost
    this.t = 0;                   // animation clock, runs even when not playing
    this.time = 0;                // seconds spent playing
    this.cam = 0;                 // world x of the screen's left edge
    this.shake = 0;               // screen shake strength in px, decays quickly
    this.clovers = 0;             // collectibles picked up (clovers / fuel bags)
  }

  get playing() { return this.status === 'playing'; }
  get controls() { return { jump: true }; }

  start() { this.status = 'playing'; }
  press() {}

  burst(x, y, n, color, speed) { this.particles.burst(x, y, n, color, speed); }

  /** Advances clocks and cosmetic effects. Returns true when the simulation should run. */
  tick(dt) {
    this.t += dt;
    this.particles.update(dt);
    this.shake *= Math.pow(0.01, dt);
    if (!this.playing) return false;
    this.time += dt;
    return true;
  }

  applyShake(g) {
    if (this.shake > 0.3) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
  }

  /** Ends the attempt once; `extra` fields are merged into the result passed to onEnd. */
  finish(won, extra = {}) {
    if (!this.playing) return;
    this.status = won ? 'won' : 'lost';
    this.audio.play(won ? 'win' : 'lose');
    this.audio.engine(40, 0);
    this.onEnd?.({ won, clovers: this.clovers, time: this.time, ...extra });
  }
}
