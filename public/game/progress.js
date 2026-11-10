// Everything the game remembers on this device. Storage keys are unchanged from the original
// game so existing players keep their progress. Every access is guarded: private windows and
// blocked storage simply behave like a fresh device.

const CLEARED = n => 'woolly_cleared_' + n;
const TOP = 'woolly_inf_top';
const NAME = 'woolly_name';
const TOP_SIZE = 10;

function read(key) {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
function write(key, value) {
  try { globalThis.localStorage?.setItem(key, value); } catch { /* storage unavailable */ }
}

export function isCleared(levelNumber) { return !!read(CLEARED(levelNumber)); }

/** Marks a level cleared locally and, when logged in, on the account (via the WR client SDK). */
export function markCleared(levelNumber) {
  write(CLEARED(levelNumber), '1');
  globalThis.WR?.cleared?.(levelNumber);
}

/** Index of the first level not cleared yet (the last level once everything is cleared). */
export function nextLevelIndex(levelCount) {
  for (let n = 1; n <= levelCount; n++) if (!isCleared(n)) return n - 1;
  return levelCount - 1;
}

/** Local Infinite Mode top 10: [{ n: name, s: score, d: distance }], best first. */
export function localTop() {
  try {
    const list = JSON.parse(read(TOP) || '[]');
    return Array.isArray(list) ? list.filter(r => r && Number.isFinite(r.s)) : [];
  } catch { return []; }
}

export function bestLocalScore() { return localTop()[0]?.s ?? 0; }

export function qualifiesForTop(score) {
  const top = localTop();
  return score > 0 && (top.length < TOP_SIZE || score > top[top.length - 1].s);
}

/** Inserts a score and returns its 0-based rank in the saved list. */
export function saveTopScore(name, score, distance) {
  const entry = { n: name, s: score, d: distance };
  const top = [...localTop(), entry].sort((a, b) => b.s - a.s).slice(0, TOP_SIZE);
  write(TOP, JSON.stringify(top));
  return top.indexOf(entry);
}

export function playerName() { return read(NAME) || 'Woolly'; }
export function setPlayerName(name) { write(NAME, name); }

/** Normalises a typed name: trimmed, at most 12 characters, never empty. */
export const cleanName = raw => String(raw || '').trim().slice(0, 12) || 'Woolly';
