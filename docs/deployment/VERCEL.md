# Vercel web deployment

The owner requested GitHub-connected web hosting and APK sideloading, and confirmed **no hosted backend exists yet**. With no `VITE_API_BASE_URL`, the hosted frontend displays a backend-not-connected notice and disables login; it never sends visitor credentials to localhost.

## Project settings

| Setting | Value |
|---|---|
| Repository | `samuelcollridgenaik-alt/clyra` (private) |
| Account / project | `samuelcollridgenaik-4398` / `clyra` |
| Root / framework | `web` / Vite |
| Install / build | `npm ci` / `npm run build` |
| Output / Node | `dist` / 22.x |

`web/vercel.json` handles SPA deep links. Git integration deploys feature-branch previews and the configured production branch. A reviewed branch can be deployed explicitly without merging its PR. Do not commit Vercel tokens or local link files.

## Connect the backend later

1. Host Express and a private MongoDB replica set. Configure network access, backups, production JWT secrets and `NODE_ENV=production` on the backend host.
2. Confirm HTTPS `/health/ready` returns `ready` / `connected`.
3. Preserve refresh cookies: use same-site HTTPS domains, or a reviewed same-origin `/api/:path*` Vercel rewrite to the real API host and set `VITE_API_BASE_URL=/api/v1`. Direct calls from `*.vercel.app` to an unrelated API domain do not support the current `SameSite=Strict` refresh cookie. Do not weaken security to conceal this issue.
4. Set backend `CORS_ORIGINS` to exact approved frontend origins. Vite variables are **public build-time values**: only put the non-secret API URL there, never a database URI or credential.
5. Redeploy; verify login, refresh after reload, complaint creation, assignment/resolution and logout against persisted data. Rebuild the standalone APK with the public API and a persistent signing identity.

Use authorized access for protected previews; do not disable deployment protection for automated testing. A successful static deployment does not prove API/database health.
