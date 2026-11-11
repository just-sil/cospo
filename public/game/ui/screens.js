// Overlay screens (intro, map, results). Built as DOM nodes with real event listeners, so player
// names and other text are always inserted as text, never as HTML.

import { localTop } from '../progress.js';

/** Tiny hyperscript: h('button', { className: 'b', onclick }, 'Start'). */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style') el.style.cssText = v;
    else if (v !== undefined && v !== null) el[k] = v;
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const button = (label, color, onclick, sub) => h('button', { type: 'button', className: `b ${color}`, onclick }, label, sub ? h('small', {}, sub) : null);
const panel = (...children) => h('div', { className: 'panel' }, ...children);

/** Top-scores table: rows of { n: name, s: score, d: distance }. */
export function scoreTable(rows, highlight = -1) {
  if (!rows.length) return h('div', { className: 'empty' }, 'No scores yet. Be the first!');
  return h('table', { className: 'scores' }, rows.map((r, i) => h('tr', { className: i === highlight ? 'me' : '' },
    h('td', {}, `${i + 1}.`), h('td', {}, String(r.n)), h('td', { className: 'n' }, String(r.s)), h('td', { className: 'd' }, `${r.d} m`))));
}

export function introScreen(level, { onStart, onLevelSelect, onFullscreen }) {
  const heading = level.infinite ? '∞' : `🐑 Level ${level.number}`;
  return panel(
    h('h2', {}, heading),
    h('h2', { style: 'margin-top:-2px' }, level.name),
    h('p', {}, h('b', {}, level.difficulty), h('br'), level.intro, h('br'), h('br'), h('small', {}, level.controls)),
    level.infinite ? h('div', { style: 'margin:4px 0 10px' }, h('b', { style: 'font-size:12px' }, '🏆 TOP SCORES'), scoreTable(localTop().slice(0, 5))) : null,
    button('▶ Start', 'green', onStart),
    button('☰ Level Select', 'blue', onLevelSelect),
    button('⛶ Fullscreen / Rotate', '', onFullscreen),
  );
}

export function mapScreen(svgMarkup, { onPick, onFullscreen }) {
  const map = h('div', { className: 'map-fit' });
  map.innerHTML = svgMarkup; // generated from constant level data only
  map.addEventListener('click', e => {
    const node = e.target.closest('[data-level]');
    if (!node) return;
    e.preventDefault();
    onPick(Number(node.dataset.level));
  });
  const el = panel(
    h('img', { className: 'logo', src: '/assets/logo.svg', alt: 'Woolly Run' }),
    h('p', { style: 'margin:0 0 8px' }, 'Tap a marker on the map to play'),
    map,
    button('⛶ Fullscreen / Rotate to landscape', '', onFullscreen),
  );
  el.classList.add('wide');
  return el;
}

export function winScreen(level, result, next, { onNext, onReplay, onMenu, menuLabel }) {
  return panel(
    h('h2', {}, '🏠 Home safe!'),
    h('p', {}, `${level.title} cleared.`, h('br'), `${result.statLabel}: ${result.clovers} / ${result.cloverTotal}`, result.hearts !== undefined ? `  ·  Hearts left: ${result.hearts}` : ''),
    next ? button(`Level ${next.number}${next.warnOnUnlock ? ` – ${next.difficulty}` : ''}`, next.warnOnUnlock ? 'red' : 'blue', onNext, next.teaser) : null,
    button('Replay', 'blue', onReplay),
    button(menuLabel, 'green', onMenu),
  );
}

export function loseScreen(level, result, { onRetry, onMenu, menuLabel }) {
  return panel(
    h('h2', {}, '🐺 Caught!'),
    h('p', {}, result.message || level.loseText),
    button('Retry', 'green', onRetry),
    button(menuLabel, 'blue', onMenu),
  );
}

/**
 * Infinite Mode results. If the score makes the local top 10, asks for a name.
 * `onDone(name|null)` restarts the run; the #wlb element is filled by WR.afterRun (online ranks).
 */
export function infiniteScreen(result, { qualifies, defaultName, onDone, onMenu }) {
  const nameInput = qualifies ? h('input', { maxLength: 12, value: defaultName, ariaLabel: 'Your name' }) : null;
  return panel(
    h('h2', {}, '∞ Run over'),
    h('p', {},
      'Distance ', h('b', {}, `${result.distance} m`), ` · Clovers ${result.clovers}`, h('br'),
      'Score ', h('b', {}, String(result.score)),
      qualifies ? [h('br'), '🏆 You made the TOP 10! Your name:', h('br'), nameInput] : null),
    h('div', {}, scoreTable(localTop().slice(0, 5))),
    h('div', { id: 'wlb' }),
    button(qualifies ? 'Save score & retry' : 'Retry', 'red', () => onDone(nameInput ? nameInput.value : null)),
    button('Menu', 'blue', onMenu),
  );
}
