// Boots the game on any game page.
//
//   <body data-level="3">    a single level page (1–10 or "infinite"): intro screen → play
//   <body data-level="map">  the all-in-one page: world map → any level, without page loads
//
// The page itself only needs /css/game.css, /config.js, /js/wr.js, /js/ads.js and this module.

import { Audio } from './core/audio.js';
import { Input } from './core/input.js';
import { Stage } from './core/stage.js';
import { ALL_LEVELS, LEVELS, findLevel } from './levels.js';
import { Platformer } from './modes/platformer.js';
import { Highway } from './modes/highway.js';
import { Space } from './modes/space.js';
import * as progress from './progress.js';
import { worldMapSvg } from './ui/worldmap.js';
import { infiniteScreen, introScreen, loseScreen, mapScreen, winScreen } from './ui/screens.js';

const MODES = { platformer: Platformer, highway: Highway, space: Space };
const STEP = 1 / 60;

class Game {
  constructor({ hub }) {
    this.hub = hub;           // true on the all-in-one map page
    this.stage = new Stage();
    this.audio = new Audio();
    this.mode = null;
    this.level = null;

    const { stage } = this;
    this.input = new Input({
      onPress: action => this.mode?.press(action),
      onGesture: () => this.audio.unlock(),
      isRotated: () => stage.rotated,
    });
    this.input.bindJoystick(stage.stick, stage.knob);
    this.input.bindHoldButton(stage.buttons.jump, 'buttonJump', 'jump');
    this.input.bindHoldButton(stage.buttons.fire, 'buttonFire');
    this.input.bindTapButton(stage.buttons.nitro, 'nitro');
    stage.buttons.mute.addEventListener('click', () => {
      this.audio.unlock();
      this.audio.setMuted(!this.audio.muted);
      stage.buttons.mute.textContent = this.audio.muted ? '🔇' : '🔊';
    });

    // Fixed-timestep loop: simulation at 60 Hz regardless of the display's refresh rate.
    let last = performance.now(), acc = 0;
    const frame = now => {
      acc += Math.min((now - last) / 1000, 0.1);
      last = now;
      while (acc >= STEP) { this.mode?.update(STEP); acc -= STEP; }
      this.mode?.draw(stage.ctx);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  /** Builds a fresh attempt of `level`, frozen until play() is called. */
  load(level) {
    this.level = level;
    this.mode = new MODES[level.mode](level, { input: this.input, view: this.stage.view, audio: this.audio });
    this.mode.onEnd = result => this.ended(result);
    this.stage.showControls(this.mode.controls);
    this.audio.engine(40, 0);
    if (!this.hub) {
      document.title = level.infinite ? 'Woolly Run – Infinite Mode' : `Woolly Run – Level ${level.number}: ${level.name}`;
      if (location.pathname !== `/${level.slug}.html`) history.replaceState(null, '', `/${level.slug}.html`);
    }
  }

  show(screen) {
    const o = this.stage.overlay;
    o.replaceChildren(screen);
    o.hidden = false;
    screen.querySelector('button')?.focus({ preventScroll: true });
  }

  play(level = this.level) {
    this.load(level);
    this.stage.overlay.hidden = true;
    this.input.reset();
    this.mode.start();
  }

  intro(level) {
    this.load(level);
    this.show(introScreen(level, {
      onStart: () => this.play(),
      onLevelSelect: () => this.menu(),
      onFullscreen: () => this.stage.toggleFullscreen(),
    }));
  }

  /** Level select: the in-page map on the hub, the home page everywhere else. */
  menu() {
    if (!this.hub) { location.href = '/index.html'; return; }
    this.load(LEVELS[0]);
    this.show(mapScreen(worldMapSvg(), {
      onPick: index => this.intro(ALL_LEVELS[index]),
      onFullscreen: () => this.stage.toggleFullscreen(),
    }));
  }

  ended(result) {
    const level = this.level, menuLabel = this.hub ? 'Menu' : 'Level Select';
    if (result.won && !level.infinite) progress.markCleared(level.number);
    const handlers = { onReplay: () => this.play(), onRetry: () => this.play(), onMenu: () => this.menu(), menuLabel };

    let screen;
    if (level.infinite) {
      const qualifies = progress.qualifiesForTop(result.score);
      screen = () => {
        this.show(infiniteScreen(result, {
          qualifies,
          defaultName: progress.playerName(),
          onDone: name => {
            if (qualifies && name !== null) {
              const clean = progress.cleanName(name);
              progress.setPlayerName(clean);
              progress.saveTopScore(clean, result.score, result.distance);
            }
            this.play();
          },
          onMenu: () => (this.hub ? this.menu() : this.intro(level)),
        }));
        globalThis.WR?.afterRun?.(result.score, result.distance, result.clovers, result.time);
      };
    } else if (result.won) {
      const next = LEVELS[level.index + 1];
      screen = () => this.show(winScreen(level, result, next, { ...handlers, onNext: () => this.intro(next) }));
    } else {
      screen = () => this.show(loseScreen(level, result, handlers));
    }

    // Short pause to enjoy the moment; losses get an interstitial ad before the results.
    const showAd = !result.won && globalThis.AD?.full;
    setTimeout(() => (showAd ? globalThis.AD.full(screen) : screen()), result.won ? 700 : level.infinite ? 700 : 600);
  }
}

const key = document.body.dataset.level || 'map';
const game = new Game({ hub: key === 'map' });
if (key === 'map') {
  game.menu();
  // Logged-in players: pull cleared levels from the account, then redraw the map's stars.
  addEventListener('load', () => globalThis.WR?.syncProgress?.().then(changed => { if (changed && game.mode && !game.mode.playing && game.stage.overlay.querySelector('svg')) game.menu(); }));
} else {
  game.intro(findLevel(key) || LEVELS[0]);
}
