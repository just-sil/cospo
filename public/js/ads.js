/*
 * Woolly Run ads: a top banner and a full-screen interstitial.
 *
 * Inside Meta Instant Games (FBInstant available + placement IDs set in Admin → Ads) these are real
 * Meta ads. Everywhere else they are clearly labelled demo placeholders. Impressions/clicks are sent
 * to /api/ads/event for the admin revenue dashboard.
 *
 * Include once per page, right after <body>:  <script src="/js/ads.js"></script>
 * API:  AD.full(callback)   show an interstitial (respecting settings), then call `callback`
 *       AD.bannerHeight()   pixels taken by the banner at the top (0 when hidden)
 * Fires a window "adlayout" event whenever the banner appears or disappears.
 */
(function () {
  if (window.AD) return;

  var BANNER_HEIGHT = 50;
  var FB_SDK = 'https://connect.facebook.net/en_US/fbinstant.7.1.js';
  var PROMOS = [
    ['Your Meta ad appears here', '#1877f2,#0a4cc0'],
    ['Advertise with Meta Ads · 320x50', '#7048e8,#1877f2'],
    ['More levels of Woolly Run!', '#2f9e44,#1c7ed6'],
  ];
  var CSS =
    '#adb{position:fixed;top:0;left:0;right:0;height:' + BANNER_HEIGHT + 'px;z-index:60;background:#0b0d16;border-bottom:1px solid #ffffff22;display:none;align-items:center;justify-content:center;overflow:hidden}' +
    '#adb .adi{position:relative;width:min(100%,468px);height:100%;display:flex;align-items:center;justify-content:center;font:700 13px system-ui,sans-serif;color:#fff;text-align:center;padding:0 22px}' +
    '#adb .adt{position:absolute;left:4px;top:3px;font-size:8px;background:#0009;padding:1px 4px;border-radius:3px}' +
    '#adf{position:fixed;inset:0;z-index:100;background:#05060c;display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:20px}' +
    '#adf .tag{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));left:14px;font-size:11px;opacity:.7;letter-spacing:.06em}' +
    '#adf .card{width:min(86vw,340px);padding:26px 18px;border-radius:18px;background:linear-gradient(135deg,#1877f2,#7048e8);cursor:pointer}' +
    '#adf .card b{display:block;font-size:44px}#adf .card h2{margin:8px 0 6px}#adf .card p{margin:0;font-size:13px;opacity:.9;line-height:1.5}' +
    '#adx{margin-top:22px;border:0;border-radius:10px;padding:12px 26px;font-size:15px;font-weight:800;background:#fff;color:#111;cursor:pointer}#adx:disabled{opacity:.45}' +
    'html.ad-banner body{padding-top:' + BANNER_HEIGHT + 'px !important}';

  var cfg = { banner: '', interstitial: '', bannerOn: true, interstitialOn: true, minGapSec: 0 };
  var meta = false, metaInterstitial = null, busy = false, promoIndex = 0, lastInterstitial = 0, ready = false;

  // ---- DOM ----
  var style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  var banner = document.createElement('div');
  banner.id = 'adb';
  var full = document.createElement('div');
  full.id = 'adf';
  full.innerHTML = '<div class="tag">ADVERTISEMENT · demo placeholder</div>' +
    '<div class="card" id="adc"><b>📣</b><h2>Your Meta ad here</h2><p>Inside Meta Instant Games this is a real full-screen Meta interstitial ad.</p></div>' +
    '<button id="adx" type="button" disabled>Close in 4</button>';
  document.body.insertBefore(full, document.body.firstChild);
  document.body.insertBefore(banner, document.body.firstChild);

  var sdk = document.createElement('script');
  sdk.async = true;
  sdk.src = FB_SDK;
  document.head.appendChild(sdk);

  // ---- helpers ----
  var isReal = function (id) { return !!id && !/^YOUR_/.test(id); };
  var bannerVisible = function () { return banner.style.display === 'flex'; };

  function track(placement, event) {
    try {
      fetch('/api/ads/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ placement: placement, event: event }), keepalive: true }).catch(function () {});
    } catch (e) { /* offline or old browser */ }
  }

  function setBanner(visible) {
    banner.style.display = visible ? 'flex' : 'none';
    if (!visible) banner.innerHTML = '';
    document.documentElement.classList.toggle('ad-banner', visible);
    window.dispatchEvent(new Event('adlayout'));
  }

  function rotatePromo() {
    if (!ready || !cfg.bannerOn || (meta && isReal(cfg.banner))) return;
    var p = PROMOS[promoIndex++ % PROMOS.length];
    banner.innerHTML = '<div class="adi" style="background:linear-gradient(90deg,' + p[1] + ')"><span class="adt">AD</span>' + p[0] + '</div>';
    track('banner', 'impression');
  }
  banner.addEventListener('click', function () { if (!meta) track('banner', 'click'); });

  function preloadInterstitial() {
    try {
      FBInstant.getInterstitialAdAsync(cfg.interstitial)
        .then(function (ad) { metaInterstitial = ad; return ad.loadAsync(); })
        .catch(function () { metaInterstitial = null; });
    } catch (e) { metaInterstitial = null; }
  }

  function initMeta() {
    var tries = 0;
    var timer = setInterval(function () {
      if (window.FBInstant && FBInstant.initializeAsync) {
        clearInterval(timer);
        try {
          FBInstant.initializeAsync().then(function () {
            meta = true;
            if (isReal(cfg.banner)) { setBanner(false); FBInstant.loadBannerAdAsync(cfg.banner).catch(function () {}); }
            if (isReal(cfg.interstitial)) preloadInterstitial();
          }).catch(function () {});
        } catch (e) { /* not running inside Instant Games */ }
      } else if (++tries > 30) clearInterval(timer);
    }, 100);
  }

  function applyConfig(a) {
    a = a || {};
    var b = a.banner || {}, i = a.interstitial || {};
    cfg.banner = b.placementId || '';
    cfg.interstitial = i.placementId || '';
    cfg.bannerOn = a.enabled !== false && b.enabled !== false;
    cfg.interstitialOn = a.enabled !== false && i.enabled !== false;
    cfg.minGapSec = +i.minGapSec || 0;
    ready = true;
    setBanner(cfg.bannerOn && !(meta && isReal(cfg.banner)));
    if (cfg.bannerOn) rotatePromo();
  }

  fetch('/api/config')
    .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
    .then(function (c) { applyConfig(c.ads); })
    .catch(function () { applyConfig({}); });
  setInterval(rotatePromo, 30000);
  initMeta();

  function showInterstitial(done) {
    var tooSoon = cfg.minGapSec && Date.now() - lastInterstitial < cfg.minGapSec * 1000;
    if (!cfg.interstitialOn || busy || tooSoon) { done(); return; }
    busy = true;
    var finish = function () { busy = false; lastInterstitial = Date.now(); done(); };

    if (meta && isReal(cfg.interstitial) && metaInterstitial) {
      var ad = metaInterstitial;
      metaInterstitial = null;
      track('interstitial', 'impression');
      ad.showAsync().then(finish, finish).then(preloadInterstitial);
      return;
    }

    // Demo placeholder with a 4-second countdown before it can be closed.
    var close = document.getElementById('adx'), card = document.getElementById('adc'), seconds = 4;
    full.style.display = 'flex';
    track('interstitial', 'impression');
    close.disabled = true;
    close.textContent = 'Close in ' + seconds;
    card.onclick = function () { track('interstitial', 'click'); card.onclick = null; };
    var timer = setInterval(function () {
      seconds--;
      if (seconds > 0) close.textContent = 'Close in ' + seconds;
      else { clearInterval(timer); close.disabled = false; close.textContent = 'Close ✕'; }
    }, 1000);
    close.onclick = function () {
      if (close.disabled) return;
      full.style.display = 'none';
      finish();
    };
  }

  window.AD = {
    full: showInterstitial,
    bannerHeight: function () { return bannerVisible() ? BANNER_HEIGHT : 0; },
  };
})();
