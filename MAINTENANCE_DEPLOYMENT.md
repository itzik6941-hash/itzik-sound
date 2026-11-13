# Temporary maintenance access

The maintenance gate is disabled unless `MAINTENANCE_MODE=true`. When enabled, visitors receive the maintenance screen and requests for studio pages, static studio assets, configuration, and private API routes are blocked before they reach the application. `/api/health` returns only a minimal health response.

## Render environment variables

Set these in the Render service's Environment settings. Never put their values in Git, HTML, JavaScript, logs, or screenshots.

- `MAINTENANCE_MODE=true` — enable the gate. Set to `false` (or remove it) to reopen the existing application to normal visitors.
- `MAINTENANCE_ADMIN_CODE` — set privately to the administrator code chosen by the owner.
- `ADMIN_SESSION_SECRET` — a separate random secret of at least 32 bytes, used to sign administrator sessions.

After changing variables, restart or redeploy the Render service. Use HTTPS; the administrator cookie is always `HttpOnly`, `Secure`, and `SameSite=Strict`, expires after eight hours, and is revoked on logout.

## Operational limits

Login rate limits and active sessions are held in process memory. Run a single server instance while using this temporary gate. Restarting the service safely expires all existing sessions and clears rate-limit state. A multi-instance deployment needs a shared session and rate-limit store before enabling this feature across instances.

No Supabase data, users, projects, storage objects, API keys, or existing auth settings are changed by the gate.
