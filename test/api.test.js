'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), http = require('http'), path = require('path');
const { createMock } = require('./mock-supabase'), { createSupabase } = require('../server/supabase'), { createApp } = require('../server/app');

let mock, server, base, app, ids = {};
const call = async (p, { method = 'GET', token, body, headers = {} } = {}) => { const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {} return { status: r.status, json: j, text: t, headers: r.headers }; };

test.before(async () => {
  mock = createMock(); const mport = await mock.listen();
  ids.admin = mock.addUser('t-admin', { email: 'boss@example.com', name: 'Boss', country: 'IN', role: 'admin' });
  ids.alice = mock.addUser('t-alice', { email: 'alice@example.com', name: 'Alice', country: 'US' });
  ids.promo = mock.addUser('t-promo', { email: 'owner@example.com', name: 'Owner', country: 'GB' });
  ids.unconf = mock.addUser('t-unconf', { email: 'owner@example.com', name: 'Spoof', country: 'GB', confirmed: false });
  ids.banned = mock.addUser('t-banned', { email: 'bad@example.com', name: 'Bad', banned: true });
  const cfg = { isProd: true, trustProxy: false, corsOrigin: '', siteUrl: 'https://game.test', supabaseUrl: 'http://127.0.0.1:' + mport, supabaseAnonKey: 'ANON', supabaseServiceKey: 'SERVICE', adminEmails: ['owner@example.com'], metaBanner: 'META_B', metaInterstitial: 'META_I' };
  const sb = createSupabase({ url: cfg.supabaseUrl, anonKey: 'ANON', serviceKey: 'SERVICE' });
  app = createApp({ cfg, sb, publicDir: path.join(__dirname, '..', 'public') });
  server = http.createServer(app.handler); await new Promise(r => server.listen(0, '127.0.0.1', r)); base = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => { app.close(); server.close(); await mock.close(); });

test('health, geo and public config (ad defaults come from env)', async () => {
  assert.equal((await call('/api/health')).json.ok, true);
  assert.equal((await call('/api/geo', { headers: { 'cf-ipcountry': 'fr' } })).json.country, 'FR');
  assert.equal((await call('/api/geo', { headers: { 'cf-ipcountry': 'ZZ' } })).json.country, '');
  const c = (await call('/api/config')).json; assert.equal(c.ads.banner.enabled, true); assert.equal(c.ads.banner.placementId, '');
  assert.ok(!JSON.stringify(c).includes('SERVICE'), 'service key must never leak');
});
test('/config.js exposes only the public anon key', async () => {
  const r = await call('/config.js'); assert.match(r.text, /supabaseAnonKey":"ANON"/); assert.ok(!r.text.includes('SERVICE'));
});
test('auth: missing / bad / banned tokens', async () => {
  assert.equal((await call('/api/me')).status, 401); assert.equal((await call('/api/me', { token: 'nope' })).status, 401);
  const b = await call('/api/me', { token: 't-banned' }); assert.equal(b.status, 403); assert.match(b.json.error, /suspended/);
});
test('/api/me returns the profile and never the service data', async () => {
  const r = await call('/api/me', { token: 't-alice' }); assert.equal(r.status, 200); assert.equal(r.json.user.name, 'Alice'); assert.equal(r.json.user.role, 'user'); assert.equal(r.json.user.country, 'US');
});
test('ADMIN_EMAILS promotion needs a confirmed email', async () => {
  assert.equal((await call('/api/me', { token: 't-unconf' })).json.user.role, 'user');
  assert.equal((await call('/api/me', { token: 't-promo' })).json.user.role, 'admin');
});
test('ad events: validation + counting', async () => {
  assert.equal((await call('/api/ads/event', { method: 'POST', body: { placement: 'popup', event: 'impression' } })).status, 400);
  assert.equal((await call('/api/ads/event', { method: 'POST', body: { placement: 'banner', event: 'hack' } })).status, 400);
  for (let i = 0; i < 3; i++) assert.equal((await call('/api/ads/event', { method: 'POST', body: { placement: 'banner', event: 'impression' } })).status, 200);
  await call('/api/ads/event', { method: 'POST', body: { placement: 'interstitial', event: 'impression' } });
  await call('/api/ads/event', { method: 'POST', body: { placement: 'banner', event: 'click' } });
});
test('admin endpoints reject normal users and anonymous callers', async () => {
  for (const p of ['/api/admin/stats', '/api/admin/users', '/api/admin/ads', '/api/admin/scores']) { assert.equal((await call(p)).status, 401, p); assert.equal((await call(p, { token: 't-alice' })).status, 403, p); }
  assert.equal((await call('/api/admin/users/' + ids.alice, { method: 'DELETE', token: 't-alice' })).status, 403);
});
test('admin stats include estimated ad revenue from eCPM', async () => {
  const s = (await call('/api/admin/stats', { token: 't-admin' })).json; assert.equal(s.users.total, 5); assert.equal(s.ads.today.imp, 4); assert.equal(s.ads.today.clk, 1);
  assert.equal(s.ads.today.est, +((3 * 0.4 + 1 * 5) / 1000).toFixed(4)); assert.equal(s.ads.series.length, 30);
});
test('admin: search, ban (also bans in Supabase Auth), unban, role change, self-protection', async () => {
  assert.equal((await call('/api/admin/users?q=alice', { token: 't-admin' })).json.users.length, 1);
  let r = await call('/api/admin/users/' + ids.alice, { method: 'PATCH', token: 't-admin', body: { banned: true } }); assert.equal(r.status, 200); assert.equal(r.json.user.banned, true);
  assert.deepEqual(mock.st.authCalls.at(-1).body, { ban_duration: '876000h' });
  r = await call('/api/admin/users/' + ids.alice, { method: 'PATCH', token: 't-admin', body: { banned: false } }); assert.deepEqual(mock.st.authCalls.at(-1).body, { ban_duration: 'none' });
  r = await call('/api/admin/users/' + ids.alice, { method: 'PATCH', token: 't-admin', body: { role: 'wizard' } }); assert.equal(r.status, 400);
  r = await call('/api/admin/users/' + ids.alice, { method: 'PATCH', token: 't-admin', body: { country: 'XX1' } }); assert.equal(r.status, 400);
  r = await call('/api/admin/users/' + ids.admin, { method: 'PATCH', token: 't-admin', body: { banned: true } }); assert.equal(r.status, 400);
  r = await call('/api/admin/users/' + ids.admin, { method: 'DELETE', token: 't-admin' }); assert.equal(r.status, 400);
  assert.equal((await call('/api/admin/users/not-a-uuid', { method: 'PATCH', token: 't-admin', body: { name: 'x' } })).status, 400);
});
test('admin: delete user', async () => { const r = await call('/api/admin/users/' + ids.unconf, { method: 'DELETE', token: 't-admin' }); assert.equal(r.status, 200); assert.equal(mock.st.authCalls.at(-1).method, 'DELETE'); });
test('admin: ad config round-trip with clamping and sanitising', async () => {
  const r = await call('/api/admin/ads/config', { method: 'PUT', token: 't-admin', body: { banner: { placementId: '123_<b>456' }, interstitial: { minGapSec: 99999 }, ecpm: { banner: -5, interstitial: 7.5 } } });
  assert.equal(r.status, 200); assert.equal(r.json.config.banner.placementId, '123_b456'); assert.equal(r.json.config.interstitial.minGapSec, 3600); assert.equal(r.json.config.ecpm.banner, 0); assert.equal(r.json.config.ecpm.interstitial, 7.5);
  const pub = (await call('/api/config')).json; assert.equal(pub.ads.banner.placementId, '123_b456');
  assert.equal((await call('/api/admin/ads/config', { method: 'PUT', token: 't-admin', body: { enabled: false } })).json.config.enabled, false); assert.equal((await call('/api/config')).json.ads.enabled, false);
});
test('admin: revenue entries add/list/delete/validation + CSV export', async () => {
  assert.equal((await call('/api/admin/ads/revenue', { method: 'POST', token: 't-admin', body: { date: 'yesterday', amount: 1 } })).status, 400);
  assert.equal((await call('/api/admin/ads/revenue', { method: 'POST', token: 't-admin', body: { date: '2025-02-01', amount: -3 } })).status, 400);
  const today = new Date().toISOString().slice(0, 10);
  const add = await call('/api/admin/ads/revenue', { method: 'POST', token: 't-admin', body: { date: today, amount: 12.5, network: 'meta', impressions: 5000, note: 'week 1' } }); assert.equal(add.status, 200);
  const ads = (await call('/api/admin/ads', { token: 't-admin' })).json; assert.equal(ads.revenue.length, 1); assert.equal(ads.series.at(-1).reported, 12.5);
  const csv = await call('/api/admin/ads/export.csv', { token: 't-admin' }); assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /text\/csv/); assert.match(csv.text, /^date,banner_impressions/); assert.ok(csv.text.includes(today + ',3,1,1,0'));
  assert.equal((await call('/api/admin/ads/revenue/' + add.json.revenue.id, { method: 'DELETE', token: 't-admin' })).status, 200);
  assert.equal((await call('/api/admin/ads/revenue/' + add.json.revenue.id, { method: 'DELETE', token: 't-admin' })).status, 404);
});
test('admin: scores list + delete', async () => {
  mock.st.scores.push({ id: 7, score: 100, name: 'Alice' }); assert.equal((await call('/api/admin/scores', { token: 't-admin' })).json.scores.length, 1);
  assert.equal((await call('/api/admin/scores/7', { method: 'DELETE', token: 't-admin' })).status, 200); assert.equal((await call('/api/admin/scores/7', { method: 'DELETE', token: 't-admin' })).status, 404);
  assert.equal((await call('/api/admin/scores/abc', { method: 'DELETE', token: 't-admin' })).status, 400);
});
test('static files: security headers, ETag, 404, traversal', async () => {
  const r = await fetch(base + '/login.html'); assert.equal(r.status, 200); assert.match(r.headers.get('content-security-policy'), /frame-ancestors/); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('strict-transport-security'), /max-age/);
  const e = r.headers.get('etag'); const r2 = await fetch(base + '/login.html', { headers: { 'If-None-Match': e } }); assert.equal(r2.status, 304);
  assert.equal((await fetch(base + '/nope.html')).status, 404);
  const raw = await new Promise(ok => { const q = http.get({ host: '127.0.0.1', port: server.address().port, path: '/..%2f..%2fserver%2fapp.js' }, x => { x.resume(); ok(x.statusCode); }); }); assert.ok([403, 404].includes(raw));
  assert.equal((await fetch(base + '/server/app.js')).status, 404);
  assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/admin')).status, 200);
});
test('unknown API route and invalid JSON', async () => {
  assert.equal((await call('/api/nope')).status, 404);
  const r = await fetch(base + '/api/ads/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' }); assert.equal(r.status, 400);
});
test('upstream Supabase failure is reported as 502 without leaking details', async () => {
  const cfg = { isProd: false, trustProxy: false, corsOrigin: '', siteUrl: '', supabaseUrl: 'http://127.0.0.1:1', supabaseAnonKey: 'ANON', supabaseServiceKey: 'SERVICE', adminEmails: [], metaBanner: '', metaInterstitial: '' };
  const a2 = createApp({ cfg, sb: createSupabase({ url: cfg.supabaseUrl, anonKey: 'ANON', serviceKey: 'SERVICE', timeoutMs: 500 }), publicDir: path.join(__dirname, '..', 'public') }); const s2 = http.createServer(a2.handler); await new Promise(r => s2.listen(0, '127.0.0.1', r));
  const r = await fetch('http://127.0.0.1:' + s2.address().port + '/api/config'); assert.equal(r.status, 502); assert.ok(!(await r.text()).includes('127.0.0.1')); s2.close(); a2.close();
});
