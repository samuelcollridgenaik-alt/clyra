# Local development

## Demo (macOS/Linux)

Requires Node.js 22, MongoDB `mongod` on PATH and optionally Flutter 3.44.9 + Android SDK.

```sh
npm ci --prefix backend
npm ci --prefix web
node scripts/demo.mjs setup
node scripts/demo.mjs start
```

Web: **http://localhost:5174**. API: **4001**. MongoDB: **27019**, loopback-only replica set, database `clyra_demo`.

Read credentials locally with `node scripts/demo.mjs credentials`. Fictional users are admin/student/faculty/staff at `clyra-demo.invalid`. Generated secrets stay in ignored, owner-readable `.local/demo-config.json`; database files stay in `.local/mongodb`.

Setup preserves existing demo data and refuses to reconfigure an unrelated database on port 27019. Run setup again after MongoDB stops. Ctrl+C stops web/API, not MongoDB. The helper uses `mongod --fork`; Windows users need manual setup.

## Manual setup / Windows

1. Start a MongoDB **replica set**; standalone MongoDB cannot support the required transactions.
2. Copy backend/web `.env.example` to local `.env`. Supply your own JWT secret and MongoDB URI. Match API port, CORS origins and web `VITE_API_BASE_URL` (manual examples use API 4000/web 5173).
3. Run `npm ci` then `npm run dev` in backend and web.
4. Temporarily configure bootstrap admin email/password, run `npm run bootstrap-admin` in backend, then remove those credentials.
5. As admin, configure departments/users and an active campus. Review four/five levels for each D–U block and Ground Floor convention before applying the layout. Add rooms/common areas manually.

Registration is off by default. Text-only resolution is enabled only by the local demo; production still requires configured evidence handling and administrator verification.

## MongoDB Compass

Connect Compass using `mongodb://127.0.0.1:27019/clyra_demo?replicaSet=clyra-dev` and save it as **Clyra Local Demo**. No username/password is required for this loopback-only demonstration. Open `clyra_demo` to inspect `complaints`, `locations`, `users`, `assignments` and history/notifications. Do not expose port 27019 to the network. Compass is a viewer/client; the running `mongod` process is the database server.

Create or update records through the app for demonstrations so validation, history and notifications stay consistent. Avoid showing session records or password hashes on a projector.

### API health

```sh
curl http://localhost:4001/health
curl http://localhost:4001/health/ready
```

Readiness returns HTTP 200 with `status: ready`, `service: clyra-api`, `database: connected`, or HTTP 503 without connection details.

See [Android](ANDROID.md) and [Vercel](VERCEL.md). The optional AI service stays private; grievance submission works without trained models.
