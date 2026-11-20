<div align="center">

<img src="web/public/clyra-mark.png" width="88" height="88" alt="Clyra logo" />

# clyra.

**Clear reporting. Accountable resolution. A connected campus.**

React web · Flutter Android · Express API · MongoDB

[Quick start](#quick-start) · [Android APK](docs/deployment/ANDROID.md) · [Deployment](docs/deployment/VERCEL.md) · [Verification](docs/testing/RESULTS.md) · [API](docs/api/CONTRACTS.md)

[Hosted frontend preview](https://clyra-lake.vercel.app) · [Download local-demo APK](https://github.com/samuelcollridgenaik-alt/clyra/releases/tag/v0.1.0-local-demo) · [Delivery PR](https://github.com/samuelcollridgenaik-alt/clyra/pull/3)

</div>

---

Clyra connects students and faculty with administrators and maintenance teams through one shared grievance workflow. Both clients use the same reports, assignments, history and resolution verification.

**Current delivery:** a functional local demonstration with tested API/database workflows, a web build and sideloadable Android APK. The hosted frontend is a preview until a public backend is configured. No trained AI, external notification delivery or production readiness is claimed. [Full status →](IMPLEMENTATION_STATUS.md)

## Highlights

- Role-scoped reporting, assignment, work tracking and administrator verification.
- **D–U blocks**, independently configurable **four/five levels**, explicit Ground Floor convention.
- Manual rooms/common areas and searchable full paths in React and Flutter, beyond 100 locations.
- Atomic history updates, real summary counts, refreshable sessions and visible error/retry states.

The campus layout is additive and repeat-safe: existing/manual locations are preserved. Actual floor counts are reviewed by an administrator, not silently assumed.

## Quick start

Requires **Node.js 22**, **MongoDB on PATH** and optionally **Flutter 3.44.9 + Android SDK**. The helper targets macOS/Linux; [manual/Windows setup](docs/deployment/LOCAL.md) is available.

```sh
git clone https://github.com/samuelcollridgenaik-alt/clyra.git
cd clyra
# Until the delivery PR is merged:
git switch codex/issue-2-demo-ready
npm ci --prefix backend
npm ci --prefix web
node scripts/demo.mjs setup
node scripts/demo.mjs start
```

Open **http://localhost:5174**. API: **4001**. MongoDB: **27019**.

In another terminal, run `node scripts/demo.mjs credentials` for the generated local password. Accounts: admin/student/faculty/staff at `clyra-demo.invalid`. Credentials and persistent demo data stay in ignored `.local/`; never commit them.

For Android, follow the [APK guide](docs/deployment/ANDROID.md). Platform sources are included; do not run `flutter create` over the application.

## Repository map

| Directory | Responsibility |
|---|---|
| `web/` | React JavaScript, Tailwind, Recharts, Vite |
| `mobile/` | Flutter/Dart Material 3 Android |
| `backend/` | Express REST API, JWT/RBAC, Mongoose transactions |
| `ai-service/` | Optional private FastAPI adapter; explicit unavailable-model state |
| `scripts/` | Local demo setup and Android packaging |
| `docs/` | Contracts, architecture, verification, policies, deployment |

Both clients call Express, never MongoDB or the AI service directly. The [master blueprint](CLYRA_CODEX_MASTER_BLUEPRINT.docx) remains authoritative alongside [the specification](CLYRA_MASTER_SPEC.md).

## Verification

```sh
npm run check --prefix backend
npm test --prefix backend
CLYRA_TEST_MONGODB_URI='mongodb://127.0.0.1:27019/clyra_ci_test?replicaSet=clyra-dev' npm run test:integration --prefix backend
npm test --prefix web
npm run build --prefix web
node --test scripts/tests/*.test.mjs
cd mobile
flutter analyze --no-fatal-infos
flutter test
```

Integration tests accept only isolated local `clyra_ci_test*` databases and remove their own test database. Never use real campus data. See [actual verification results](docs/testing/RESULTS.md), including warnings and remaining coverage.

## Deployment & security

Vercel hosts `web/` through GitHub integration. A **hosted MongoDB replica set and public HTTPS Express API are still required** for online functionality. [Deployment instructions](docs/deployment/VERCEL.md) cover cookie routing and private configuration.

Secrets, keystores, local databases and builds are excluded from Git. Media, FCM and email/password reset require additional setup. Text-only resolution is explicitly development-only. Read [pending campus policies](docs/decisions/PENDING.md) before accepting real users.
