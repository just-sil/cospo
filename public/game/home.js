// Home page (index.html): the world map plus the Infinite Mode top 5
// (world leaderboard when the server is configured, this device's scores otherwise).

import { worldMapSvg } from './ui/worldmap.js';
import { localTop } from './progress.js';

const mapEl = document.getElementById('map');
const boardEl = document.getElementById('lbx');
const renderMap = () => { mapEl.innerHTML = worldMapSvg(); };

function localBoard() {
  const top = localTop().slice(0, 5);
  if (!top.length) {
    boardEl.innerHTML = '<div class="muted">No scores yet. Play Infinite Mode!</div>';
    return;
  }
  const table = document.createElement('table');
  table.className = 'lbt';
  top.forEach((r, i) => {
    const row = table.insertRow();
    [[`${i + 1}.`, 'rk'], [String(r.n), 'nm'], [String(r.s), 'sc'], [`${r.d} m`, 'ds']].forEach(([text, cls]) => {
      const cell = row.insertCell();
      cell.className = cls;
      cell.textContent = text;
    });
  });
  boardEl.replaceChildren(table);
}

renderMap();
addEventListener('load', () => { // wr.js is deferred: wait until it has run
  const WR = globalThis.WR;
  if (!WR?.configured()) { localBoard(); return; }
  WR.syncProgress().then(changed => { if (changed) renderMap(); });
  WR.rpc('leaderboard', { p_scope: 'world', p_limit: 5 }).then(rows => { boardEl.innerHTML = WR.rows(rows); }).catch(localBoard);
});
