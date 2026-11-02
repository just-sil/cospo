'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
function load(cfg) {
  const store = {}, el = { innerHTML: '', textContent: '' };
  const win = { WR_CONFIG: cfg, document: null, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }, Intl, location: { pathname: '/infinite.html' } };
  win.document = { getElementById: id => (id === 'wlb' ? el : null), addEventListener() {}, createElement: () => ({}), head: { appendChild() {} } };
  win.window = win; Object.defineProperty(win, 'localStorage', { value: win.localStorage });
  vm.createContext(win); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'wr.js'), 'utf8'), win, { filename: 'wr.js' }); return { WR: win.WR, store, el };
}
test('flags: emoji + image with fallback, safe for bad input', () => {
  const { WR } = load({}); assert.equal(WR.emoji('in'), '🇮🇳'); assert.equal(WR.emoji('zz9'), '🏳️');
  assert.match(WR.flag('IN'), /flagcdn\.com\/24x18\/in\.png/); assert.ok(!WR.flag('"><script>').includes('<script>'));
});
test('country list is complete, named and sorted', () => {
  const { WR } = load({}); const c = WR.countries(); assert.ok(c.length === 250); assert.ok(c.find(x => x.code === 'IN' && x.name === 'India')); const names = Array.from(c, x => x.name); assert.equal(JSON.stringify(names), JSON.stringify([...names].sort((a, b) => a.localeCompare(b))));
});
test('leaderboard rows escape player names (no XSS) and mark me', () => {
  const { WR } = load({}); const h = WR.rows([{ rnk: 1, name: '<img src=x onerror=alert(1)>', country: 'US', score: 99, distance: 10, is_me: true }]);
  assert.ok(!h.includes('<img src=x')); assert.match(h, /&lt;img/); assert.match(h, /class="me"/); assert.match(h, /🥇/); assert.match(WR.rows([]), /Be the first/);
});
test('error codes from SQL map to friendly text', () => {
  const { WR } = load({}); assert.match(WR.errMsg({ message: 'implausible_run' }), /rejected/); assert.match(WR.errMsg({ message: 'country_required' }), /country/i); assert.equal(WR.errMsg({ message: 'Some other thing' }), 'Some other thing');
});
test('without server config the game hooks are harmless', () => {
  const { WR, store, el } = load({}); assert.equal(WR.configured(), false); WR.cleared(3); assert.equal(store.woolly_cleared_3, '1'); WR.afterRun(100, 50, 5, 20); assert.equal(el.innerHTML, '');
});
test('logged-out player is invited to log in after a run', () => {
  const { WR, el } = load({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' }); assert.equal(WR.configured(), true); WR.afterRun(100, 50, 5, 20); assert.match(el.innerHTML, /login\.html\?next=%2Finfinite\.html/);
});
