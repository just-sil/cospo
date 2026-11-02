'use strict';
/* Minimal Supabase client for the server (Auth + PostgREST RPC) using the built-in fetch. No dependencies. */
class SupabaseError extends Error { constructor(status, message, body) { super(message); this.status = status; this.body = body; } }

function createSupabase({ url, anonKey, serviceKey, timeoutMs = 8000, fetchImpl = fetch }) {
  const base = url.replace(/\/+$/, '');
  async function call(path, { method = 'GET', headers = {}, body } = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetchImpl(base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal });
      const text = await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch (e) { /* not json */ }
      if (!r.ok) throw new SupabaseError(r.status, (json && (json.message || json.msg || json.error_description || json.error)) || 'Supabase request failed', json);
      return json;
    } catch (e) { if (e instanceof SupabaseError) throw e; if (e.name === 'AbortError') throw new SupabaseError(504, 'Supabase request timed out'); throw new SupabaseError(502, 'Supabase is unreachable'); } finally { clearTimeout(t); }
  }
  const svc = { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey };
  return {
    /** Verify a player's access token with Supabase Auth and return the auth user (or null). */
    async getUser(accessToken) {
      try { return await call('/auth/v1/user', { headers: { apikey: anonKey, Authorization: 'Bearer ' + accessToken } }); }
      catch (e) { if (e instanceof SupabaseError && (e.status === 401 || e.status === 403 || e.status === 400)) return null; throw e; }
    },
    /** Call a SQL function (service role). */
    rpc: (fn, args = {}) => call('/rest/v1/rpc/' + fn, { method: 'POST', headers: svc, body: args }),
    /** Call a SQL function as the player (their JWT), e.g. for RLS-aware reads. */
    rpcAs: (token, fn, args = {}) => call('/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: anonKey, Authorization: 'Bearer ' + token }, body: args }),
    /** Public (anon) RPC, e.g. leaderboards. */
    rpcAnon: (fn, args = {}) => call('/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: anonKey, Authorization: 'Bearer ' + anonKey }, body: args }),
    admin: {
      setBan: (id, banned) => call('/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'PUT', headers: svc, body: { ban_duration: banned ? '876000h' : 'none' } }),
      deleteUser: id => call('/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'DELETE', headers: svc }),
    },
  };
}
module.exports = { createSupabase, SupabaseError };
