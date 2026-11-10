// The island world map (used by the home page and the all-in-one play page), generated from the
// level catalogue instead of being a hand-written 18 KB SVG.

import { INFINITE, LEVELS } from '../levels.js';
import { isCleared, nextLevelIndex } from '../progress.js';

const TILTS = [-6, 0, 6];
const PROP_OFFSETS = [[-74, -24], [74, -30], [36, 38]];
const LABEL = 'paint-order:stroke;stroke:#0a1020;stroke-linejoin:round;font-family:system-ui,sans-serif;font-weight:800';

const STYLE = `.nd{cursor:pointer}.nb{transform-box:fill-box;transform-origin:center;transition:transform .15s}
.nd:hover .nb,.nd:focus .nb,.nd:active .nb{transform:scale(1.14)}.nd:focus{outline:none}
.bob{animation:bob 1.1s ease-in-out infinite}@keyframes bob{50%{transform:translateY(-8px)}}
.spin{transform-box:fill-box;transform-origin:center;animation:spin 9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.lbl{${LABEL};stroke-width:4px}`;

/** Smooth path through the points (Catmull-Rom converted to cubic Béziers). */
function smoothPath(pts) {
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = Math.round(p1.x + (p2.x - p0.x) / 6), c1y = Math.round(p1.y + (p2.y - p0.y) / 6);
    const c2x = Math.round(p2.x - (p3.x - p1.x) / 6), c2y = Math.round(p2.y - (p3.y - p1.y) / 6);
    d += ` C${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

function island({ x, y, land }, tilt) {
  return `<g transform="rotate(${tilt} ${x} ${y})">` +
    `<ellipse cx="${x + 4}" cy="${y + 8}" rx="132" ry="82" fill="#000" opacity=".25"/>` +
    `<ellipse cx="${x}" cy="${y}" rx="128" ry="78" fill="${land}" stroke="#fff" stroke-opacity=".55" stroke-width="4"/>` +
    `<ellipse cx="${x - 6}" cy="${y - 14}" rx="100" ry="50" fill="#fff" opacity=".13"/></g>`;
}

function marker(level, cleared, href) {
  const { x, y, color, props } = level.map;
  const emoji = props.map((e, i) => `<text x="${x + PROP_OFFSETS[i][0]}" y="${y + PROP_OFFSETS[i][1]}" font-size="30" text-anchor="middle">${e}</text>`).join('');
  return `<a class="nd" href="${href(level)}" data-level="${level.index}" aria-label="Level ${level.number}: ${level.name}">${emoji}` +
    `<g transform="translate(${x} ${y})"><g class="nb">` +
    '<circle r="44" fill="transparent"/><circle r="31" fill="#000" opacity=".3" cy="4"/>' +
    `<circle r="29" fill="${color}" stroke="#fff" stroke-width="5"/><circle r="29" fill="url(#glow)"/>` +
    `<text y="11" text-anchor="middle" font-size="30" font-weight="900" fill="#fff" style="font-family:system-ui,sans-serif">${level.number}</text></g>` +
    (cleared ? '<text x="26" y="-22" font-size="24" text-anchor="middle">⭐</text>' : '') +
    `<text class="lbl" y="56" text-anchor="middle" font-size="16" fill="#fff">${level.name}</text>` +
    `<text class="lbl" y="72" text-anchor="middle" font-size="11" fill="#ffd8a8" style="stroke-width:3px">${level.difficulty.replace('MEDIUM-', 'MED-')}</text></g></a>`;
}

/**
 * @param {object} [opts]
 * @param {(level) => string} [opts.href]  link for each marker (default: the level's own page)
 * @returns {string} SVG markup (static content only, safe for innerHTML)
 */
export function worldMapSvg({ href = level => `/${level.slug}.html` } = {}) {
  const nodes = LEVELS.map(l => l.map), inf = INFINITE.map;
  const next = LEVELS[nextLevelIndex(LEVELS.length)].map;
  let waves = '';
  for (let i = 0; i < 30; i++) {
    waves += `<path d="M${(20 + i * 149) % 700} ${(30 + i * 97) % 1200} q10 -9 20 0 t20 0" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="3"/>`;
  }
  return '<svg viewBox="0 0 760 1240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Level map" style="width:100%;height:auto;display:block;border-radius:16px">' +
    `<style>${STYLE}</style>` +
    '<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1f4f"/><stop offset=".5" stop-color="#1f5f9a"/><stop offset="1" stop-color="#2aa3c9"/></linearGradient>' +
    '<radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
    '<rect width="760" height="1240" fill="url(#sea)"/>' + waves +
    nodes.map((n, i) => island(n, TILTS[i % 3])).join('') +
    `<path d="${smoothPath(nodes)}" fill="none" stroke="#fff3c4" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 15" opacity=".95"/>` +
    // Infinite Mode's swirling island at the top
    `<path d="M${nodes[9].x} ${nodes[9].y} Q270 150 ${inf.x} ${inf.y}" fill="none" stroke="#e599f7" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 15"/>` +
    `<ellipse cx="${inf.x}" cy="${inf.y}" rx="118" ry="74" fill="#2a1450" stroke="#e599f7" stroke-opacity=".7" stroke-width="4"/>` +
    `<g class="spin"><circle cx="${inf.x}" cy="${inf.y}" r="62" fill="none" stroke="#c084fc" stroke-width="5" stroke-dasharray="14 10"/></g>` +
    `<g class="spin" style="animation-direction:reverse"><circle cx="${inf.x}" cy="${inf.y}" r="44" fill="none" stroke="#7ee7ff" stroke-width="4" stroke-dasharray="8 10"/></g>` +
    LEVELS.map(l => marker(l, isCleared(l.number), href)).join('') +
    `<a class="nd" href="${href(INFINITE)}" data-level="${INFINITE.index}" aria-label="Infinite Mode"><g transform="translate(${inf.x} ${inf.y})"><g class="nb">` +
    '<circle r="48" fill="transparent"/><circle r="30" fill="#7048e8" stroke="#fff" stroke-width="5"/>' +
    '<text y="12" text-anchor="middle" font-size="36" font-weight="900" fill="#fff" style="font-family:system-ui,sans-serif">∞</text></g>' +
    '<text class="lbl" y="60" text-anchor="middle" font-size="16" fill="#fff">Infinite Mode</text>' +
    '<text class="lbl" y="76" text-anchor="middle" font-size="11" fill="#e599f7" style="stroke-width:3px">NOT A LEVEL · TOP SCORES</text></g></a>' +
    `<g transform="translate(${next.x} ${next.y - 62})"><g class="bob"><text text-anchor="middle" font-size="40">🐑</text></g></g>` +
    '<text x="380" y="1218" text-anchor="middle" class="lbl" font-size="13" fill="#bfe3ff" style="stroke-width:3px">⭐ = cleared · 🐑 = your next level</text>' +
    '</svg>';
}
