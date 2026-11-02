'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { SupabaseError } = require('./supabase');

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const COUNTRIES = 'AQ BV CC CX EH GS HM IO PN SH SJ TF UM AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const clean = (s, n = 40) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

function createApp({ cfg, sb, publicDir }) {
  const buckets = new Map();
  const limited = (key, max, ms) => { const now = Date.now(); let b = buckets.get(key); if (!b || b.t < now) { b = { t: now + ms, n: 0 }; buckets.set(key, b); } return ++b.n > max; };
  const gc = setInterval(() => { const n = Date.now(); for (const [k, v] of buckets) if (v.t < n) buckets.delete(k); }, 60000); gc.unref();
  const tokenCache = new Map(); // access token -> { exp, user }
  const ipOf = req => (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';
  const geo = req => { for (const h of ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country', 'x-appengine-country', 'x-country-code', 'fly-region-country']) { const v = String(req.headers[h] || '').toUpperCase(); if (COUNTRIES.includes(v)) return v; } return ''; };
  let cfgCache = { t: 0, v: null };
  const getConfig = async (force) => { if (!force && cfgCache.v && Date.now() - cfgCache.t < 15000) return cfgCache.v; const v = (await sb.rpc('srv_get_config')) || {}; cfgCache = { t: Date.now(), v }; return v; };
  const adsDefaults = () => ({ enabled: true, banner: { enabled: true, placementId: cfg.metaBanner }, interstitial: { enabled: true, placementId: cfg.metaInterstitial, minGapSec: 0 }, ecpm: { banner: 0.4, interstitial: 5 } });
  const adsCfg = async () => { const a = (await getConfig()).ads || {}, d = adsDefaults(); return { enabled: a.enabled ?? d.enabled, banner: { ...d.banner, ...(a.banner || {}) }, interstitial: { ...d.interstitial, ...(a.interstitial || {}) }, ecpm: { ...d.ecpm, ...(a.ecpm || {}) } }; };

  /** Resolve the signed-in player from the Supabase access token. */
  async function authUser(req, required = true) {
    const h = String(req.headers.authorization || ''); const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!token) { if (required) throw new HttpError(401, 'Please log in'); return null; }
    let hit = tokenCache.get(token); if (!hit || hit.exp < Date.now()) {
      const au = await sb.getUser(token); if (!au || !au.id) { if (required) throw new HttpError(401, 'Your session has expired. Please log in again.'); return null; }
      hit = { exp: Date.now() + 30000, au }; tokenCache.set(token, hit); if (tokenCache.size > 5000) tokenCache.clear();
    }
    const email = (hit.au.email || '').toLowerCase();
    const promote = !!email && cfg.adminEmails.includes(email) && hit.au.email_confirmed_at !== null && hit.au.email_confirmed_at !== undefined;
    const profile = await sb.rpc('srv_sync_profile', { p_id: hit.au.id, p_email: email || null, p_make_admin: promote });
    if (!profile) { if (required) throw new HttpError(404, 'Profile not found'); return null; }
    if (profile.banned) throw new HttpError(403, 'This account is suspended');
    return { auth: hit.au, profile, token };
  }
  const needAdmin = async req => { const u = await authUser(req); if (u.profile.role !== 'admin') throw new HttpError(403, 'Admins only'); return u; };
  const publicProfile = p => ({ id: p.id, name: p.name, country: p.country, avatar_url: p.avatar_url, role: p.role, best_score: p.best_score, best_distance: p.best_distance, cleared: p.cleared || [], created_at: p.created_at });

  const routes = [];
  const R = (method, p, fn) => routes.push({ method, re: new RegExp('^' + p.replace(/:[a-z]+/g, '([^/]+)') + '$'), fn });
  R('GET', '/api/health', async () => ({ ok: true, time: new Date().toISOString() }));
  R('GET', '/api/geo', async ({ req }) => ({ country: geo(req) }));
  R('GET', '/api/config', async () => { const a = await adsCfg(); return { siteName: 'Woolly Run', ads: { enabled: a.enabled, banner: { enabled: a.banner.enabled, placementId: a.banner.placementId }, interstitial: { enabled: a.interstitial.enabled, placementId: a.interstitial.placementId, minGapSec: a.interstitial.minGapSec } } }; });
  R('GET', '/api/me', async ({ req }) => { const u = await authUser(req); return { user: publicProfile(u.profile), email: u.profile.email }; });
  R('POST', '/api/ads/event', async ({ req, body }) => {
    if (limited('ad:' + ipOf(req), 240, 60000)) throw new HttpError(429, 'Too many events');
    if (!['banner', 'interstitial'].includes(body.placement) || !['impression', 'click'].includes(body.event)) throw new HttpError(400, 'Bad event');
    await sb.rpc('srv_track_ad', { p_placement: body.placement, p_event: body.event }); return { ok: true }; });

  // ---- admin ----
  const sum = (a, k) => a.reduce((p, d) => p + (d[k] || 0), 0);
  const withEst = (series, e) => series.map(d => ({ ...d, estRevenue: +(((d.bannerImp * e.banner) + (d.intImp * e.interstitial)) / 1000).toFixed(4) }));
  const total = rows => ({ imp: sum(rows, 'bannerImp') + sum(rows, 'intImp'), clk: sum(rows, 'bannerClk') + sum(rows, 'intClk'), est: +sum(rows, 'estRevenue').toFixed(4), rep: +sum(rows, 'reported').toFixed(2) });
  R('GET', '/api/admin/stats', async ({ req }) => { await needAdmin(req); const [st, ser, a] = await Promise.all([sb.rpc('srv_admin_stats'), sb.rpc('srv_ad_series', { p_days: 30 }), adsCfg()]);
    const series = withEst(ser || [], a.ecpm); return { users: st.users, scores: st.scores, top: st.top, ads: { today: total(series.slice(-1)), week: total(series.slice(-7)), month: total(series), series } }; });
  R('GET', '/api/admin/users', async ({ req, query }) => { await needAdmin(req); return sb.rpc('srv_admin_users', { p_q: clean(query.get('q'), 60), p_page: Math.max(1, +query.get('page') || 1), p_per: 25 }); });
  R('PATCH', '/api/admin/users/:id', async ({ req, body, params: [id] }) => { const a = await needAdmin(req); if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Bad id');
    if (id === a.profile.id && (body.banned || (body.role && body.role !== 'admin'))) throw new HttpError(400, "You can't lock yourself out");
    const patch = {}; if (body.name != null) patch.name = clean(body.name, 24); if (body.country != null) { const c = String(body.country).toUpperCase(); if (c && !COUNTRIES.includes(c)) throw new HttpError(400, 'Invalid country'); patch.country = c; }
    if (body.role != null) { if (!['user', 'admin'].includes(body.role)) throw new HttpError(400, 'Invalid role'); patch.role = body.role; } if (body.banned != null) patch.banned = !!body.banned;
    const user = await sb.rpc('srv_admin_update_user', { p_id: id, p_patch: patch }); if (!user) throw new HttpError(404, 'No such user'); if (body.banned != null) await sb.admin.setBan(id, !!body.banned); return { user }; });
  R('DELETE', '/api/admin/users/:id', async ({ req, params: [id] }) => { const a = await needAdmin(req); if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Bad id'); if (id === a.profile.id) throw new HttpError(400, "You can't delete yourself"); await sb.admin.deleteUser(id); return { ok: true }; });
  R('GET', '/api/admin/scores', async ({ req }) => { await needAdmin(req); return { scores: await sb.rpc('srv_admin_scores', { p_limit: 200 }) }; });
  R('DELETE', '/api/admin/scores/:id', async ({ req, params: [id] }) => { await needAdmin(req); if (!/^\d{1,18}$/.test(id)) throw new HttpError(400, 'Bad id'); if (!(await sb.rpc('srv_admin_delete_score', { p_id: +id }))) throw new HttpError(404, 'No such score'); return { ok: true }; });
  R('GET', '/api/admin/ads', async ({ req }) => { await needAdmin(req); const [a, ser, rev] = await Promise.all([adsCfg(), sb.rpc('srv_ad_series', { p_days: 30 }), sb.rpc('srv_revenue_list', { p_limit: 200 })]); return { config: a, series: withEst(ser || [], a.ecpm), revenue: rev || [] }; });
  R('PUT', '/api/admin/ads/config', async ({ req, body }) => { await needAdmin(req); const cur = await adsCfg(), n = x => Math.max(0, Math.min(1000, +x || 0)); const x = body || {};
    const next = { enabled: x.enabled != null ? !!x.enabled : cur.enabled,
      banner: { enabled: x.banner && x.banner.enabled != null ? !!x.banner.enabled : cur.banner.enabled, placementId: x.banner && x.banner.placementId != null ? clean(x.banner.placementId, 80) : cur.banner.placementId },
      interstitial: { enabled: x.interstitial && x.interstitial.enabled != null ? !!x.interstitial.enabled : cur.interstitial.enabled, placementId: x.interstitial && x.interstitial.placementId != null ? clean(x.interstitial.placementId, 80) : cur.interstitial.placementId, minGapSec: x.interstitial && x.interstitial.minGapSec != null ? Math.min(3600, Math.max(0, +x.interstitial.minGapSec || 0)) : cur.interstitial.minGapSec },
      ecpm: { banner: x.ecpm && x.ecpm.banner != null ? n(x.ecpm.banner) : cur.ecpm.banner, interstitial: x.ecpm && x.ecpm.interstitial != null ? n(x.ecpm.interstitial) : cur.ecpm.interstitial } };
    await sb.rpc('srv_set_config', { p_key: 'ads', p_value: next }); cfgCache = { t: 0, v: null }; return { config: next }; });
  R('POST', '/api/admin/ads/revenue', async ({ req, body: b }) => { await needAdmin(req); if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) throw new HttpError(400, 'Date must be YYYY-MM-DD'); const amount = +b.amount; if (!Number.isFinite(amount) || amount < 0 || amount > 1e7) throw new HttpError(400, 'Bad amount');
    const row = await sb.rpc('srv_revenue_add', { p_day: b.date, p_network: clean(b.network || 'meta', 20), p_placement: clean(b.placement || 'all', 20), p_amount: amount, p_impressions: Math.max(0, Math.floor(+b.impressions || 0)), p_note: clean(b.note, 80) }); return { revenue: row }; });
  R('DELETE', '/api/admin/ads/revenue/:id', async ({ req, params: [id] }) => { await needAdmin(req); if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, 'Bad id'); if (!(await sb.rpc('srv_revenue_delete', { p_id: id }))) throw new HttpError(404, 'Not found'); return { ok: true }; });
  R('GET', '/api/admin/ads/export.csv', async ({ req }) => { await needAdmin(req); const a = await adsCfg(); const ser = withEst((await sb.rpc('srv_ad_series', { p_days: 90 })) || [], a.ecpm);
    const csv = ['date,banner_impressions,banner_clicks,interstitial_impressions,interstitial_clicks,estimated_revenue_usd,reported_revenue_usd', ...ser.map(d => [d.date, d.bannerImp, d.bannerClk, d.intImp, d.intClk, d.estRevenue, d.reported].join(','))].join('\n');
    return { raw: csv, type: 'text/csv', headers: { 'Content-Disposition': 'attachment; filename="ads-report.csv"' } }; });

  // ---- /config.js : public browser config (anon key is public by design) ----
  const configJs = () => `window.WR_CONFIG=${JSON.stringify({ supabaseUrl: cfg.supabaseUrl, supabaseAnonKey: cfg.supabaseAnonKey, siteUrl: cfg.siteUrl })};`;

  // ---- security headers ----
  const connect = ["'self'", cfg.supabaseUrl, cfg.supabaseUrl.replace(/^http/, 'ws')].filter(Boolean).join(' ');
  const CSP = ["default-src 'self'", `script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://connect.facebook.net`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://flagcdn.com https://*.googleusercontent.com https://*.fbcdn.net https://platform-lookaside.fbsbx.com https://*.supabase.co",
    `connect-src ${connect} https://*.facebook.com https://*.fbcdn.net`, "font-src 'self' data:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self' https://apps.facebook.com https://www.facebook.com"].join('; ');
  const secHeaders = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'geolocation=(), camera=(), microphone=()', 'Content-Security-Policy': CSP, ...(cfg.isProd ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}) };

  function serveStatic(req, res, pathname) {
    if (pathname === '/') pathname = '/index.html'; else if (pathname === '/admin' || pathname === '/admin/') pathname = '/admin.html';
    let f; try { f = path.normalize(path.join(publicDir, decodeURIComponent(pathname))); } catch (e) { res.writeHead(400, secHeaders); return res.end('Bad request'); }
    if (!f.startsWith(publicDir + path.sep)) { res.writeHead(403, secHeaders); return res.end('Forbidden'); }
    fs.stat(f, (e, st) => {
      if (e || !st.isFile()) { res.writeHead(404, { ...secHeaders, 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
      const ext = path.extname(f).toLowerCase(); const etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
      const h = { ...secHeaders, 'Content-Type': MIME[ext] || 'application/octet-stream', ETag: etag, 'Cache-Control': ext === '.html' || ext === '.js' ? 'no-cache' : 'public, max-age=86400' };
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
      h['Content-Length'] = st.size; res.writeHead(200, h); if (req.method === 'HEAD') return res.end(); fs.createReadStream(f).pipe(res);
    });
  }
  const send = (res, code, obj, extra = {}) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...secHeaders, ...extra }); res.end(b); };
  const readBody = req => new Promise((ok, no) => { let d = '', n = 0; req.on('data', c => { n += c.length; if (n > 1e5) { no(new HttpError(413, 'Body too large')); req.destroy(); } else d += c; }); req.on('end', () => { if (!d) return ok({}); try { const j = JSON.parse(d); ok(j && typeof j === 'object' ? j : {}); } catch (e) { no(new HttpError(400, 'Invalid JSON')); } }); req.on('error', no); });

  async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://localhost'), p = url.pathname;
      if (cfg.corsOrigin && p.startsWith('/api/')) { res.setHeader('Access-Control-Allow-Origin', cfg.corsOrigin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS'); if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); } }
      if (p === '/config.js') { res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', ...secHeaders }); return res.end(configJs()); }
      if (p.startsWith('/api/')) {
        if (limited('ip:' + ipOf(req), 600, 60000)) return send(res, 429, { error: 'Too many requests' });
        const r = routes.find(x => x.method === req.method && x.re.test(p)); if (!r) return send(res, 404, { error: 'Unknown endpoint' });
        const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
        const out = await r.fn({ req, res, body, query: url.searchParams, params: (p.match(r.re) || []).slice(1).map(decodeURIComponent) });
        if (out && out.raw !== undefined) { res.writeHead(200, { 'Content-Type': out.type, ...secHeaders, ...(out.headers || {}) }); return res.end(out.raw); }
        return send(res, 200, out || { ok: true });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, secHeaders); return res.end(); }
      serveStatic(req, res, p);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message });
      if (e instanceof SupabaseError) { console.error('[supabase]', e.status, e.message); return send(res, e.status >= 500 || e.status === 504 ? 502 : 400, { error: e.status >= 500 ? 'Upstream service error' : e.message }); }
      console.error(e); send(res, 500, { error: 'Server error' });
    }
  }
  return { handler, COUNTRIES, close: () => clearInterval(gc) };
}
module.exports = { createApp, HttpError };
