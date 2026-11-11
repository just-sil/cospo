'use strict';
// Game engine tests: the browser ES modules under public/game run headlessly in Node
// (no DOM needed for simulation; drawing goes to a fake canvas context).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');

const GAME = path.join(__dirname, '..', 'public', 'game');
const load = file => import(pathToFileURL(path.join(GAME, file)).href);
const DT = 1 / 60, VIEW = () => ({ w: 800, h: 450 });

/** Input state as the modes read it; tests flip fields directly. */
const makeInput = (o = {}) => ({ left: false, right: false, up: false, down: false, jump: false, fire: false, stickX: 0, stickY: 0, ...o });

/** A canvas 2D context that accepts every call, so all drawing code can run. */
function fakeCanvas() {
  const gradient = { addColorStop() {} }, calls = { n: 0 };
  const special = { measureText: () => ({ width: 100 }), createLinearGradient: () => gradient, createRadialGradient: () => gradient };
  return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : special[k] || (() => { calls.n++; })),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

/** Minimal localStorage for progress tests. */
function withStorage(fn) {
  const store = {};
  globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  try { return fn(store); } finally { delete globalThis.localStorage; }
}

async function platformer(levelKey, inputOverrides) {
  const [{ Platformer }, { findLevel }] = await Promise.all([load('modes/platformer.js'), load('levels.js')]);
  const input = makeInput(inputOverrides);
  const game = new Platformer(findLevel(levelKey), { input, view: VIEW(), rng: () => 0.5 });
  const ends = [];
  game.onEnd = r => ends.push(r);
  game.start();
  return { game, input, ends, run: (seconds, each) => { for (let i = 0; i < seconds * 60; i++) { each?.(i); game.update(DT); } } };
}

// ---------------------------------------------------------------------------------------------
// Level catalogue and pages

test('catalogue: 10 numbered levels plus Infinite Mode, each with a page that boots the engine', async () => {
  const { LEVELS, INFINITE, ALL_LEVELS, findLevel } = await load('levels.js');
  assert.equal(LEVELS.length, 10);
  assert.equal(ALL_LEVELS.length, 11);
  LEVELS.forEach((l, i) => {
    assert.equal(l.number, i + 1);
    assert.equal(l.slug, `level-${i + 1}`);
    assert.equal(findLevel(i + 1), l);
    assert.ok(['platformer', 'highway', 'space'].includes(l.mode), l.slug);
  });
  assert.equal(findLevel('infinite'), INFINITE);
  assert.equal(findLevel(42), undefined);
  for (const l of ALL_LEVELS) {
    const html = fs.readFileSync(path.join(GAME, '..', `${l.slug}.html`), 'utf8');
    assert.match(html, /<script type="module" src="\/game\/main\.js"><\/script>/);
    assert.match(html, new RegExp(`data-level="${l.infinite ? 'infinite' : l.number}"`));
    assert.match(html, /\/js\/ads\.js/);
  }
  assert.match(fs.readFileSync(path.join(GAME, '..', 'play.html'), 'utf8'), /data-level="map"/);
});

test('catalogue: platformer layouts are sound (spawn on ground, goal reachable, checkpoints and wolves on platforms)', async () => {
  const { ALL_LEVELS } = await load('levels.js');
  for (const l of ALL_LEVELS.filter(x => x.mode === 'platformer')) {
    const plats = l.world.platforms;
    assert.ok(plats[0][0] === 0 && plats[0][2] > 40, `${l.slug}: sheep spawns on the first platform`);
    if (!l.infinite) assert.ok(l.goal < l.length && plats.some(p => p[0] <= l.goal && p[0] + p[2] > l.goal), `${l.slug}: barn stands on a platform`);
    const onSolid = (x, y) => plats.some(p => p[3] !== 'm' && p[1] === y && x >= p[0] - 1 && x <= p[0] + p[2] + 1);
    for (const [x, y] of l.world.checkpoints || []) assert.ok(onSolid(x, y), `${l.slug}: checkpoint at ${x} floats`);
    for (const [, y, min, max] of l.world.wolves || []) assert.ok(onSolid(min, y) && onSolid(max, y), `${l.slug}: wolf patrol ${min}-${max} leaves its platform`);
  }
});

// ---------------------------------------------------------------------------------------------
// Core platformer rules

test('jumping: held jump reaches full height, a tap gives a short hop, double jump goes higher', async () => {
  const apex = async (hold, double) => {
    const { game, input } = await platformer(1);
    game.update(DT); // settle on the ground
    input.jump = hold;
    game.press('jump');
    let top = game.player.y;
    for (let i = 0; i < 90; i++) {
      if (double && i === 20) game.press('jump');
      game.update(DT);
      top = Math.min(top, game.player.y);
    }
    return 380 - top;
  };
  const full = await apex(true, false), hop = await apex(false, false), dbl = await apex(true, true);
  assert.ok(full > 80 && full < 100, `full jump ${full}`);
  assert.ok(hop < full - 20, `short hop ${hop} vs ${full}`);
  assert.ok(dbl > full + 40, `double jump ${dbl}`);
});

test('falling into a gap: free respawn on Level 1, costs a heart on Level 2', async () => {
  const one = await platformer(1);
  one.game.player.x = 560; // the first gap on Level 1
  one.run(1);
  assert.equal(one.game.hearts, 5);
  assert.equal(Math.round(one.game.player.x), 40);

  const two = await platformer(2);
  two.game.player.x = 310; // the gap after the first ground
  two.run(1);
  assert.equal(two.game.hearts, 2);
  assert.ok(two.game.player.x < 100);
});

test('wolves: stomping from above kills and bounces, touching from the side hurts', async () => {
  const { game, run } = await platformer(1);
  const wolf = game.wolves[0];
  Object.assign(game.player, { x: wolf.x, y: wolf.y - 60, vy: 200 });
  wolf.speed = 0;
  run(0.3);
  assert.equal(wolf.dead, true);
  assert.equal(game.hearts, 5);

  const side = await platformer(1);
  const w2 = side.game.wolves[0];
  w2.speed = 0;
  Object.assign(side.game.player, { x: w2.x - 10, y: 380, grounded: true });
  side.run(0.05);
  assert.equal(side.game.hearts, 4);
  assert.ok(side.game.player.invuln > 1);
  side.run(0.2); // still invulnerable: no second hit
  assert.equal(side.game.hearts, 4);
});

test('crumbling boards fall, come back, and crumble again', async () => {
  const { game, run } = await platformer(2);
  const board = game.platforms.find(p => p.type === 'c');
  const standOn = () => Object.assign(game.player, { x: board.x + board.w / 2, y: board.y - 2, vy: 0, vx: 0 });
  standOn();
  run(0.2);
  assert.ok(board.crumbleTimer > 0, 'starts crumbling when stepped on');
  run(0.5);
  assert.equal(board.fallen, true);
  run(3);
  assert.equal(board.fallen, false, 'respawns');
  game.player.invuln = 10;
  standOn();
  run(0.8);
  assert.equal(board.fallen, true, 'crumbles again (the original game left it solid forever)');
});

test('checkpoints: respawn point moves; healing follows each level\'s rule', async () => {
  const one = await platformer(1);
  one.game.hearts = 2;
  one.game.player.x = 1101;
  one.run(DT);
  assert.equal(one.game.hearts, 5, 'Level 1 refills');
  assert.equal(one.game.player.respawnX, 1110);

  const six = await platformer(6);
  six.game.hearts = 1;
  six.game.player.x = 1271; six.game.player.y = 360;
  six.run(DT);
  assert.equal(six.game.hearts, 2, 'Frostbite Pass adds one');

  const two = await platformer(2);
  two.game.hearts = 1;
  two.game.player.x = 1111;
  two.run(DT);
  assert.equal(two.game.hearts, 1, 'Night of Fire does not heal');
});

test('reaching the barn wins and reports clovers and hearts', async () => {
  const { game, ends, run } = await platformer(1, { right: true });
  Object.assign(game.player, { x: 2880, y: 380 });
  run(0.5);
  assert.equal(game.status, 'won');
  assert.equal(ends.length, 1);
  assert.deepEqual({ won: ends[0].won, hearts: ends[0].hearts, label: ends[0].statLabel }, { won: true, hearts: 5, label: 'Clovers' });
  assert.equal(ends[0].cloverTotal, game.cloverItems.length);
});

test('clover placement is the same on every attempt', async () => {
  const a = (await platformer(10)).game.cloverItems.map(c => c.x).join();
  const b = (await platformer(10)).game.cloverItems.map(c => c.x).join();
  assert.equal(a, b);
});

// ---------------------------------------------------------------------------------------------
// Level features

test('Neon Wolfpack: the shield absorbs hits before hearts, kills repair it, FIRE spends ammo', async () => {
  const { game, input, run } = await platformer(8);
  const neon = game.features[0];
  game.hurt();
  assert.equal(game.hearts, 3);
  assert.equal(neon.shield, 75);
  game.player.invuln = 0;
  for (let i = 0; i < 3; i++) { neon.absorbHit(); }
  assert.equal(neon.shield, 0);
  game.player.invuln = 0; // shield hits grant a short invulnerability
  game.hurt();
  assert.equal(game.hearts, 2, 'broken shield: hearts take the hit');
  game.stomp(game.wolves[0]);
  assert.equal(neon.shield, 35);
  input.fire = true;
  run(0.5);
  assert.ok(neon.ammo < 10 && neon.bullets.length > 0);
  assert.equal(game.controls.fire, true);
});

test('Sky Kingdom: a cape gives 8 s of flight; staying 3 s on a storm board calls lightning', async () => {
  const { game, input, run } = await platformer(9);
  const sky = game.features[0], cape = sky.capes[0];
  Object.assign(game.player, { x: cape.x, y: cape.y + 20 });
  run(DT);
  assert.ok(game.player.superTime > 7.9);
  input.jump = true;
  run(1);
  assert.ok(game.player.y < 300, 'flies up while JUMP is held');
  input.jump = false;
  game.player.superTime = 0.01;
  run(0.1);
  assert.equal(game.player.superTime, 0);

  const storm = await platformer(9);
  const board = storm.game.platforms.find(p => p.type === 'g');
  Object.assign(storm.game.player, { x: board.x + board.w / 2, y: board.y, invuln: 0 });
  storm.run(2.9);
  assert.equal(storm.game.hearts, 3);
  storm.run(0.2);
  assert.equal(storm.game.hearts, 2);
});

test('Infinite Mode: generates ahead, forgets what is behind, scores metres + 10 per clover', async () => {
  const { distanceOf, scoreOf, speedSteps } = await load('features/infinite.js');
  assert.equal(scoreOf(distanceOf(1234), 5), 173);
  assert.equal(speedSteps(249), 0);
  assert.equal(speedSteps(500), 2);
  assert.equal(speedSteps(99999), 8);

  const { game, run } = await platformer('infinite');
  const inf = game.features[0];
  run(0.1);
  assert.ok(inf.genX > game.cam + game.view.w * 1.8, 'level exists well ahead of the screen');
  game.player.invuln = 999;
  game.player.x = 5000; game.cam = 4600;
  run(0.1);
  assert.ok(game.platforms.every(p => p.x + p.w + p.moveX > game.cam - 500), 'old platforms are culled');
  assert.ok(game.checkpoints.some(c => c.x > 1500), 'checkpoints keep appearing');
  assert.equal(game.level.infinite, true);
});

test('Infinite Mode: the scrolling edge pushes and hurts; the run ends with a score', async () => {
  const { game, ends, run } = await platformer('infinite');
  run(40);
  assert.equal(game.status, 'lost');
  assert.equal(ends.length, 1);
  assert.ok(ends[0].infinite && ends[0].score > 0 && ends[0].distance > 0);
});

// ---------------------------------------------------------------------------------------------
// Vehicle levels

test('Sunset Highway: throttle burns fuel, an empty tank stops the bike, the flag wins', async () => {
  const [{ Highway }, { findLevel }] = await Promise.all([load('modes/highway.js'), load('levels.js')]);
  const lose = new Highway(findLevel(3), { input: makeInput(), view: VIEW() });
  let result = null;
  lose.onEnd = r => (result = r);
  lose.start();
  lose.bike.fuel = 0.5;
  for (let i = 0; i < 120; i++) lose.update(DT);
  assert.equal(result?.won, false);

  const win = new Highway(findLevel(3), { input: makeInput({ right: true }), view: VIEW() });
  win.onEnd = r => (result = r);
  win.start();
  win.bike.x = 6780; win.bike.v = 200;
  for (let i = 0; i < 30; i++) win.update(DT);
  assert.equal(result.won, true);
  assert.equal(result.statLabel, 'Fuel bags');
});

test('Starfall Run: fixed seeded layout, clear of black holes; NITRO costs fuel; black hole cores swallow', async () => {
  const [{ Space, buildSpaceLayout }, { findLevel }] = await Promise.all([load('modes/space.js'), load('levels.js')]);
  const a = buildSpaceLayout(9000), b = buildSpaceLayout(9000);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(a.asteroids.length > 20 && a.mines.length > 10);
  for (const o of [...a.asteroids, ...a.mines]) assert.ok(a.blackHoles.every(h => Math.abs(o.x - h.x) >= 450));

  const s = new Space(findLevel(4), { input: makeInput(), view: VIEW() });
  let result = null;
  s.onEnd = r => (result = r);
  s.start();
  assert.deepEqual(s.controls, { jump: false, nitro: true });
  s.press('nitro');
  for (let i = 0; i < 60; i++) s.update(DT);
  assert.ok(s.ship.fuel < 90 && s.ship.nitro > 0);

  const hole = s.blackHoles[0];
  s.ship.nitro = 0;
  s.cam = hole.x - s.ship.sx;
  s.ship.sy = hole.y;
  s.ship.invuln = 99;
  s.update(DT);
  assert.equal(result.won, false);
  assert.match(result.message, /black hole/);
});

// ---------------------------------------------------------------------------------------------
// Rendering, progress, map

test('every mode renders every frame without errors (fake canvas)', async () => {
  const [{ ALL_LEVELS }, { Platformer }, { Highway }, { Space }] = await Promise.all([load('levels.js'), load('modes/platformer.js'), load('modes/highway.js'), load('modes/space.js')]);
  const MODES = { platformer: Platformer, highway: Highway, space: Space };
  for (const level of ALL_LEVELS) {
    const input = makeInput({ right: true, fire: true });
    const game = new MODES[level.mode](level, { input, view: VIEW() });
    const g = fakeCanvas();
    game.draw(g); // frozen intro scene
    game.start();
    for (let i = 0; i < 60 * 8 && game.playing; i++) {
      if (i % 37 === 0) { game.press('jump'); game.press('nitro'); }
      game.update(DT);
      if (i % 5 === 0) game.draw(g);
    }
    game.draw(g); // end scene
  }
});

test('progress: cleared levels, local top 10 and player names (same storage keys as before)', async () => {
  const p = await load('progress.js');
  withStorage(store => {
    assert.equal(p.nextLevelIndex(10), 0);
    p.markCleared(1); p.markCleared(2);
    assert.equal(store.woolly_cleared_2, '1');
    assert.equal(p.nextLevelIndex(10), 2);
    assert.equal(p.qualifiesForTop(0), false);
    for (let i = 1; i <= 10; i++) p.saveTopScore('P' + i, i * 100, i * 10);
    assert.equal(p.localTop().length, 10);
    assert.equal(p.localTop()[0].s, 1000);
    assert.equal(p.qualifiesForTop(50), false);
    assert.equal(p.saveTopScore('Best', 5000, 400), 0);
    assert.equal(p.localTop().length, 10);
    assert.equal(p.bestLocalScore(), 5000);
    store.woolly_inf_top = '{broken json';
    assert.deepEqual(p.localTop(), []);
    assert.equal(p.cleanName('   '), 'Woolly');
    assert.equal(p.cleanName('  A very long player name '), 'A very long ');
  });
  assert.deepEqual(p.localTop(), [], 'no storage at all is fine');
});

test('world map: one marker per level, stars for cleared levels, custom links', async () => {
  const { worldMapSvg } = await load('ui/worldmap.js');
  withStorage(() => {
    const plain = worldMapSvg();
    assert.equal((plain.match(/class="nd"/g) || []).length, 11);
    assert.ok(plain.includes('href="/level-7.html"') && plain.includes('href="/infinite.html"'));
    assert.ok(!plain.includes('⭐</text><text class="lbl" y="56"'));
    globalThis.localStorage.setItem('woolly_cleared_3', '1');
    const starred = worldMapSvg({ href: l => '#' + l.slug });
    assert.equal((starred.match(/⭐<\/text><text class="lbl" y="56"/g) || []).length, 1);
    assert.ok(starred.includes('href="#level-3"'));
  });
});
