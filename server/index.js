'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
try { fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); }); } catch (e) { /* no .env file */ }
const { createSupabase } = require('./supabase');
const { createApp } = require('./app');

const env = process.env;
const cfg = { port: +env.PORT || 3000, isProd: env.NODE_ENV === 'production', trustProxy: env.TRUST_PROXY === '1', siteUrl: (env.SITE_URL || '').replace(/\/+$/, ''), corsOrigin: env.CORS_ORIGIN || '',
  supabaseUrl: (env.SUPABASE_URL || '').replace(/\/+$/, ''), supabaseAnonKey: env.SUPABASE_ANON_KEY || '', supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
  adminEmails: (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean), metaBanner: env.META_BANNER_PLACEMENT_ID || '', metaInterstitial: env.META_INTERSTITIAL_PLACEMENT_ID || '' };
const missing = ['supabaseUrl', 'supabaseAnonKey', 'supabaseServiceKey'].filter(k => !cfg[k]);
if (missing.length) { console.error('Missing environment variables: ' + missing.map(k => ({ supabaseUrl: 'SUPABASE_URL', supabaseAnonKey: 'SUPABASE_ANON_KEY', supabaseServiceKey: 'SUPABASE_SERVICE_ROLE_KEY' })[k]).join(', ') + '\nCopy .env.example to .env and fill it in.'); process.exit(1); }

const sb = createSupabase({ url: cfg.supabaseUrl, anonKey: cfg.supabaseAnonKey, serviceKey: cfg.supabaseServiceKey });
const app = createApp({ cfg, sb, publicDir: path.join(__dirname, '..', 'public') });
const server = http.createServer(app.handler);
server.keepAliveTimeout = 65000; server.headersTimeout = 66000; server.requestTimeout = 30000;
server.listen(cfg.port, () => console.log(`Woolly Run listening on :${cfg.port}  (admin panel: /admin)`));
const stop = () => { console.log('Shutting down...'); app.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
process.on('unhandledRejection', e => console.error('unhandledRejection', e));
