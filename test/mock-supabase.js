'use strict';
/* A tiny in-memory stand-in for Supabase (Auth + the srv_* RPCs) so the Node server can be tested without a real project. */
const http = require('http'), crypto = require('crypto');
function createMock({ serviceKey = 'SERVICE', anonKey = 'ANON' } = {}) {
  const st = { tokens: {}, profiles: {}, scores: [], adDaily: {}, revenue: [], config: { ads: { enabled: true, banner: { enabled: true, placementId: '' }, interstitial: { enabled: true, placementId: '', minGapSec: 0 }, ecpm: { banner: 0.4, interstitial: 5 } } }, authCalls: [], seq: 1 };
  const addUser = (token, { id = crypto.randomUUID(), email, name = 'Player', country = null, role = 'user', banned = false, confirmed = true }) => { st.tokens[token] = { id, email, email_confirmed_at: confirmed ? '2025-01-01T00:00:00Z' : null };
    st.profiles[id] = { id, email, name, country, role, banned, avatar_url: null, best_score: 0, best_distance: 0, best_at: null, cleared: [], created_at: new Date().toISOString(), last_seen: new Date().toISOString() }; return id; };
  const day = () => new Date().toISOString().slice(0, 10);
  const rpc = {
    srv_sync_profile: ({ p_id, p_email, p_make_admin }) => { const p = st.profiles[p_id]; if (!p) return null; if (p_email) p.email = p_email; p.last_seen = new Date().toISOString(); if (p_make_admin) p.role = 'admin'; return { ...p }; },
    srv_get_config: () => st.config, srv_set_config: ({ p_key, p_value }) => { st.config[p_key] = p_value; return null; },
    srv_track_ad: ({ p_placement, p_event }) => { const d = (st.adDaily[day()] = st.adDaily[day()] || {}); const k = p_placement + ':' + p_event; d[k] = (d[k] || 0) + 1; return null; },
    srv_ad_series: ({ p_days }) => { const out = []; for (let i = p_days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), a = st.adDaily[d] || {};
      out.push({ date: d, bannerImp: a['banner:impression'] || 0, bannerClk: a['banner:click'] || 0, intImp: a['interstitial:impression'] || 0, intClk: a['interstitial:click'] || 0, reported: st.revenue.filter(r => r.date === d).reduce((s, r) => s + r.amount, 0) }); } return out; },
    srv_admin_stats: () => { const ps = Object.values(st.profiles); return { users: { total: ps.length, new7: ps.length, active24: ps.length, banned: ps.filter(p => p.banned).length, byCountry: [['IN', 2]] }, scores: st.scores.length, top: [] }; },
    srv_admin_users: ({ p_q }) => { const q = (p_q || '').toLowerCase(); const us = Object.values(st.profiles).filter(p => !q || p.name.toLowerCase().includes(q) || (p.email || '').includes(q)); return { total: us.length, page: 1, users: us }; },
    srv_admin_update_user: ({ p_id, p_patch }) => { const p = st.profiles[p_id]; if (!p) return null; Object.assign(p, p_patch); return { ...p }; },
    srv_admin_scores: () => st.scores, srv_admin_delete_score: ({ p_id }) => { const i = st.scores.findIndex(s => s.id === p_id); if (i < 0) return false; st.scores.splice(i, 1); return true; },
    srv_revenue_list: () => st.revenue.map(r => ({ ...r })),
    srv_revenue_add: ({ p_day, p_network, p_placement, p_amount, p_impressions, p_note }) => { const r = { id: crypto.randomUUID(), date: p_day, network: p_network, placement: p_placement, amount: p_amount, impressions: p_impressions, note: p_note }; st.revenue.push(r); return r; },
    srv_revenue_delete: ({ p_id }) => { const i = st.revenue.findIndex(r => r.id === p_id); if (i < 0) return false; st.revenue.splice(i, 1); return true; },
  };
  const server = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const j = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(o == null ? '' : JSON.stringify(o)); };
    const auth = String(req.headers.authorization || ''), isSvc = auth === 'Bearer ' + serviceKey && req.headers.apikey === serviceKey;
    if (req.url === '/auth/v1/user') { const t = auth.replace('Bearer ', ''); const u = st.tokens[t]; return u && req.headers.apikey === anonKey ? j(200, u) : j(401, { msg: 'invalid JWT' }); }
    let m = req.url.match(/^\/auth\/v1\/admin\/users\/([^/?]+)$/); if (m) { if (!isSvc) return j(403, { msg: 'not admin' }); st.authCalls.push({ method: req.method, id: m[1], body: b ? JSON.parse(b) : null }); if (req.method === 'DELETE') { delete st.profiles[m[1]]; } return j(200, {}); }
    m = req.url.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/); if (m) { const fn = rpc[m[1]]; if (!fn) return j(404, { message: 'function not found' }); if (m[1].startsWith('srv_') && !isSvc) return j(401, { message: 'permission denied' });
      try { return j(200, fn(b ? JSON.parse(b) : {})); } catch (e) { return j(400, { message: e.message }); } }
    j(404, { message: 'not found' }); }); });
  return { st, addUser, rpc, listen: () => new Promise(r => server.listen(0, '127.0.0.1', () => r(server.address().port))), close: () => new Promise(r => server.close(r)) };
}
module.exports = { createMock };
