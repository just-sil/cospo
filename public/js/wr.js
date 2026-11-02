/* Woolly Run client SDK: Supabase auth + leaderboards + flags. Needs /config.js loaded first. */
(function () {
  if (window.WR) return;
  var CFG = window.WR_CONFIG || {}, SB_SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  var CODES = 'AQ BV CC CX EH GS HM IO PN SH SJ TF UM AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'.split(' ');
  var ERR = { login_required: 'Please log in first.', country_required: 'Choose your country in your account first.', rate_limited: 'Slow down a little.', implausible_run: 'That run was rejected as implausible.', account_suspended: 'This account is suspended.', invalid_score: 'Invalid score data.', invalid_country: 'Invalid country.' };
  var clientP = null, meCache = null;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var WR = window.WR = {
    cfg: CFG, esc: esc,
    configured: function () { return !!(CFG.supabaseUrl && CFG.supabaseAnonKey); },
    sb: function () {
      if (clientP) return clientP;
      clientP = new Promise(function (ok, no) {
        if (!WR.configured()) return no(new Error('Server is not configured'));
        function make() { ok(window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })); }
        if (window.supabase && window.supabase.createClient) return make();
        var s = document.createElement('script'); s.src = SB_SRC; s.onload = make; s.onerror = function () { clientP = null; no(new Error('Could not load the login library')); }; document.head.appendChild(s);
      });
      return clientP;
    },
    hasStoredSession: function () { try { return Object.keys(localStorage).some(function (k) { return /^sb-.*-auth-token$/.test(k); }); } catch (e) { return false; } },
    session: function () { return WR.sb().then(function (c) { return c.auth.getSession(); }).then(function (r) { return r.data.session; }); },
    token: function () { return WR.session().then(function (s) { return s ? s.access_token : null; }); },
    errMsg: function (e) { var m = (e && (e.message || e.error_description)) || ''; return ERR[m] || ERR[(m.match(/[a-z_]+/) || [''])[0]] || m || 'Something went wrong'; },
    me: function (force) {
      if (meCache && !force) return meCache;
      meCache = WR.sb().then(function (c) { return c.auth.getSession().then(function (r) { if (!r.data.session) return null; return c.rpc('my_profile').then(function (x) { if (x.error) throw x.error; return x.data; }); }); }).catch(function () { return null; });
      return meCache;
    },
    api: function (path, opt) {
      opt = opt || {};
      return WR.token().then(function (t) {
        var h = { 'Content-Type': 'application/json' }; if (t) h.Authorization = 'Bearer ' + t;
        return fetch('/api' + path, { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined }).then(function (r) {
          if (opt.raw) return r;
          return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || 'Request failed'); e.status = r.status; throw e; } return j; });
        });
      });
    },
    rpc: function (fn, args) { return WR.sb().then(function (c) { return c.rpc(fn, args || {}); }).then(function (r) { if (r.error) throw r.error; return r.data; }); },
    signOut: function () { return WR.sb().then(function (c) { return c.auth.signOut(); }).then(function () { meCache = null; }); },
    // ---- countries & flags ----
    codes: CODES,
    emoji: function (cc) { cc = String(cc || '').toUpperCase(); return /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1)) : '🏳️'; },
    cname: function (cc) { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(String(cc).toUpperCase()) || cc; } catch (e) { return cc; } },
    countries: function () { return CODES.map(function (c) { return { code: c, name: WR.cname(c) }; }).sort(function (a, b) { return a.name.localeCompare(b.name); }); },
    flag: function (cc) {
      cc = String(cc || '').toLowerCase(); if (!/^[a-z]{2}$/.test(cc)) return '<span class="fl">🏳️</span>';
      return '<img class="fl" alt="' + cc.toUpperCase() + '" title="' + esc(WR.cname(cc)) + '" src="https://flagcdn.com/24x18/' + cc + '.png" width="24" height="18" loading="lazy" onerror="this.outerHTML=\'<span class=fl>' + WR.emoji(cc) + '</span>\'">';
    },
    countrySelect: function (sel, value) { sel.innerHTML = '<option value="">Select your country…</option>' + WR.countries().map(function (c) { return '<option value="' + c.code + '">' + WR.emoji(c.code) + ' ' + esc(c.name) + '</option>'; }).join(''); if (value) sel.value = value; },
    // ---- leaderboard table ----
    rows: function (rows) {
      if (!rows || !rows.length) return '<div class="muted" style="padding:10px 0">No scores yet. Be the first!</div>';
      return '<table class="lbt">' + rows.map(function (r) { var medal = r.rnk === 1 ? '🥇' : r.rnk === 2 ? '🥈' : r.rnk === 3 ? '🥉' : r.rnk + '.';
        return '<tr class="' + (r.is_me ? 'me' : '') + '"><td class="rk">' + medal + '</td><td>' + WR.flag(r.country) + '</td><td class="nm">' + esc(r.name) + '</td><td class="sc">' + r.score + '</td><td class="ds">' + r.distance + ' m</td></tr>'; }).join('') + '</table>';
    },
    // ---- profile chip ----
    chip: function (el) {
      if (!el) return; el.innerHTML = '<a class="chip" href="/login.html?next=' + encodeURIComponent(location.pathname) + '">🔐 Log in</a>';
      if (!WR.configured() || !WR.hasStoredSession()) return;
      WR.me().then(function (p) { if (!p) return; el.innerHTML = '<a class="chip" href="/account.html">' + (p.avatar_url ? '<img class="av" src="' + esc(p.avatar_url) + '" alt="">' : '👤') + ' ' + esc(p.name) + ' ' + WR.flag(p.country) + '</a>'; });
    },
    // ---- game hooks (safe no-ops when logged out) ----
    syncProgress: function () {
      if (!WR.configured() || !WR.hasStoredSession()) return Promise.resolve(false);
      return WR.me().then(function (p) { if (!p) return false; (p.cleared || []).forEach(function (n) { try { localStorage.setItem('woolly_cleared_' + n, '1'); } catch (e) {} }); return true; });
    },
    cleared: function (n) {
      try { localStorage.setItem('woolly_cleared_' + n, '1'); } catch (e) {}
      if (!WR.configured() || !WR.hasStoredSession()) return;
      WR.rpc('mark_level_cleared', { p_level: n }).catch(function () {});
    },
    afterRun: function (score, dist, clovers, duration) {
      var el = document.getElementById('wlb'); if (!el) return;
      var login = '<a href="/login.html?next=' + encodeURIComponent(location.pathname) + '" style="color:#7ee7ff">🔐 Log in</a> to post this score on the world &amp; country boards';
      if (!WR.configured()) return;
      if (!WR.hasStoredSession()) { el.innerHTML = login; return; }
      el.textContent = 'Posting your score…';
      WR.me().then(function (p) {
        if (!p) { el.innerHTML = login; return; }
        if (!p.country) { el.innerHTML = '🌍 <a href="/account.html" style="color:#7ee7ff">Choose your country</a> to join the rankings'; return; }
        return WR.rpc('submit_score', { p_score: score, p_distance: dist, p_clovers: clovers || 0, p_duration: Math.max(1, Math.round(duration || 1)) }).then(function (r) {
          return Promise.all([WR.rpc('leaderboard', { p_scope: 'world', p_limit: 3 }), WR.rpc('leaderboard', { p_scope: 'country', p_country: p.country, p_limit: 3 })]).then(function (b) {
            el.innerHTML = '<div style="margin:4px 0">🌍 World rank <b>#' + r.worldRank + '</b> of ' + r.worldTotal + ' · ' + WR.flag(p.country) + ' ' + WR.esc(WR.cname(p.country)) + ' <b>#' + r.countryRank + '</b> of ' + r.countryTotal + '</div>' +
              '<div class="muted" style="font-size:11px">Top in the world</div>' + WR.rows(b[0]) + '<div class="muted" style="font-size:11px">Top in ' + WR.esc(WR.cname(p.country)) + '</div>' + WR.rows(b[1]) + '<a href="/leaderboard.html" style="color:#7ee7ff">Full leaderboard →</a>';
          });
        }).catch(function (e) { el.textContent = 'Could not post score: ' + WR.errMsg(e); });
      });
    },
  };
  document.addEventListener('DOMContentLoaded', function () { var c = document.getElementById('wr-chip'); if (c) WR.chip(c); });
})();
