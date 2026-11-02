# 🐑 Woolly Run

A sheep platformer for the web: **10 levels** on a world map, a separate **Infinite Mode** with an auto-scrolling, ever-faster screen, **world / country leaderboards with flags**, **Google · Facebook · e-mail login**, an **admin panel** (users + ad revenue) and Meta-ads placements. Built on **Supabase** (Auth + Postgres) with a small dependency-free **Node.js** server.

```
Browser ──(Supabase JS: login, leaderboards, score submit via RPC)──► Supabase (Auth + Postgres + RLS)
   │
   └──(/api/*: ad config, ad events, admin)──► Node server ──(service_role key)──► Supabase
```

## What's included

| Area | Details |
|---|---|
| Game | `public/level-1.html … level-10.html`, `infinite.html`, map hub `index.html`, all-in-one `play.html`, 4 mini-games in `public/extras/` |
| Login | `public/login.html` – Google, Facebook, e-mail (sign-up, log-in, forgot/reset password), country picker |
| Rankings | `public/leaderboard.html` – 🌍 world, 🏳️ per country (flag images from flagcdn, emoji fallback), 🌐 country ranking |
| Account | `public/account.html` – edit name/country, ranks, levels cleared (synced across devices) |
| Admin | `public/admin.html` (`/admin`) – dashboard, users (search/ban/promote/delete), ads settings, revenue entries, CSV export, score moderation |
| Backend | `server/` – static hosting + CSP/security headers, `/config.js`, ad config + events, admin API, rate limiting, health check |
| Database | `supabase/migrations/…init.sql` – tables, RLS, triggers, RPC functions (all validation lives in SQL) |
| Tests | `npm test` – 22 tests (server API against a mock Supabase, client SDK) |
| Logo | `public/assets/logo.svg`, `icon.svg`, PNG icons, `favicon.svg`, PWA `manifest.webmanifest` |

## 1. Create the Supabase project (≈10 min)

1. Go to <https://supabase.com> → **New project**. Save the database password.
2. **SQL editor → New query**, paste the whole file `supabase/migrations/20250101000000_init.sql`, run it. (Or with the CLI: `supabase link --project-ref <ref> && supabase db push`.)
3. **Project Settings → API**: copy the **Project URL**, the **anon public** key and the **service_role** key.
4. **Authentication → URL Configuration**
   * *Site URL*: your public URL (e.g. `https://game.example.com`; locally `http://localhost:3000`).
   * *Redirect URLs*: add `https://game.example.com/login.html`, `https://game.example.com/` (and the `http://localhost:3000/...` equivalents for development).
5. **Authentication → Providers**
   * **Email**: enabled. In production switch **Confirm email** *on*.
   * **Google**: create an *OAuth client ID (Web application)* at <https://console.cloud.google.com/apis/credentials>. Add the **Authorized redirect URI** shown in the Supabase Google provider page (`https://<ref>.supabase.co/auth/v1/callback`). Paste client ID + secret into Supabase.
   * **Facebook**: create an app at <https://developers.facebook.com/apps> → add *Facebook Login* → **Valid OAuth Redirect URI** = `https://<ref>.supabase.co/auth/v1/callback`. Paste app ID + secret into Supabase. (Request `email` permission; switch the app to *Live* mode before launch.)
6. Optional but recommended: **Authentication → Rate limits / Attack protection** (CAPTCHA) for sign-ups.

## 2. Configure and run the server

```bash
cp .env.example .env      # fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS, SITE_URL
npm start                 # no `npm install` needed – zero dependencies, Node 18+
# open http://localhost:3000
```

* `ADMIN_EMAILS`: e-mails listed here become **admin** the first time they sign in (the address must be confirmed). Or promote manually: `update public.profiles set role='admin' where email='you@example.com';`
* The **service_role key must never reach the browser or git**. Only `SUPABASE_URL` and the *anon* key are exposed (through `/config.js`).

### Docker
```bash
docker compose up --build        # uses .env
```
### Render / Railway / Fly / any Node host
Start command `node server/index.js`, health check `/api/health`, set the env vars from `.env.example` and `TRUST_PROXY=1`. A ready `render.yaml` is included. Put it behind HTTPS (the platform does this for you).

## 3. Leaderboards (world + country)

* A player picks a **country** at sign-up (auto-suggested from CDN geo headers such as Cloudflare/Vercel) or in *My account*. The flag appears next to every name.
* Infinite Mode posts the score with the Supabase RPC `submit_score`. **Everything is validated in SQL**: logged-in, not banned, country set, plausible (`distance ≤ 35 m/s × time`, `score ≤ metres + 10 × clovers`), rate-limited (5 s), only each player's top 20 runs are kept.
* Boards: `leaderboard('world'|'country')`, `country_ranking()` (sum of each country's top-10 players), `my_rank()`.
* Honest limitation: any score sent from a browser can be forged by a determined cheater; the checks above stop casual tampering and the admin panel (*Scores*) lets you delete suspicious runs and ban accounts. Add replay validation later if you need competitive-grade protection.

## 4. Ads (Meta) and revenue

* Every game page has a **top banner** and a **full-screen ad on game over**. Until you configure Meta, these are clearly labelled demo placeholders.
* **Real Meta ads** run inside **Meta Instant Games** (the SDK is already included: banner + interstitial via `FBInstant`). Publish the game there, create placements in *Monetization Manager*, then paste the **banner** and **interstitial placement IDs** in **Admin → Ads & revenue → Ad settings** (no redeploy needed). Meta's Audience Network for *native apps* is a different SDK and needs an Android/iOS wrapper.
* The server records **impressions and clicks** per day (`ad_daily`) and estimates revenue with the eCPM you set. **Real revenue is reported by Meta**, so enter it in *Add real revenue* (or paste daily numbers) and compare estimated vs reported; export CSV any time.
* Toggle banner / interstitial on or off, or set a minimum gap between full-screen ads, from the same screen.

## 5. Admin panel (`/admin`)

Dashboard (players, active, new, ads totals, charts, top countries/scores) · Users (search, ban/unban in Supabase Auth too, promote/demote, delete) · Ads & revenue · Scores moderation. Only `role = 'admin'` profiles can call `/api/admin/*`; every request is verified against Supabase Auth.

## 6. Production checklist

- [ ] HTTPS only; `NODE_ENV=production`, `TRUST_PROXY=1` behind a proxy
- [ ] Confirm-email **on**, CAPTCHA enabled in Supabase
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only in server env / secret manager
- [ ] Facebook app in **Live** mode, Google OAuth consent screen published
- [ ] Meta placement IDs entered, test with a real Instant Games build
- [ ] Back up the database (Supabase → Database → Backups)
- [ ] Add your privacy policy / terms links (required by Google, Facebook and Meta)
- [ ] Monitor `/api/health`

## 7. Development

```bash
npm test          # API tests (mock Supabase) + client tests
npm run check     # syntax check of the server
```
`supabase start` (CLI + Docker) runs a full local Supabase using `supabase/config.toml`.

## Project layout

```
server/            index.js (boot) · app.js (routes, security, static) · supabase.js (REST/Auth client)
public/            game pages, login/account/leaderboard/admin, js/wr.js (client SDK), css, assets (logo)
supabase/          migrations/*.sql, config.toml
test/              api.test.js, client.test.js, mock-supabase.js
```
