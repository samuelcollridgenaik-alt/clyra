# CLYRA — AI-Powered Campus Experience & Operations

Blueprint-driven MCA final-year project. **This repository is an incremental implementation, not a deployed or fully validated finished product.** Read [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for actual scope. Original authoritative proposal is `CLYRA_CODEX_MASTER_BLUEPRINT.docx` (40 pages).

## Architecture

- `backend/`: Express REST API, Mongoose/MongoDB `clyra_db`, JWT/RBAC, complaint lifecycle.
- `web/`: React JavaScript/Tailwind SPA for administrators, faculty and staff using the shared API.
- `mobile/`: Flutter/Dart Material 3 Android source, same API.
- `ai-service/`: FastAPI service with explicit *model-unavailable* behavior until trained/evaluated artifacts exist.
- `docs/`: contracts, source-traceable decisions, architecture, testing, deployment.

## Local run (Windows PowerShell or similar)

Prerequisites: Node.js 20+, Python 3.11+, MongoDB (prefer a replica set for multi-document transactions), Flutter SDK for Android, and optionally MongoDB Compass. Install dependencies yourself; no API keys are included.

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

In a second terminal:

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

AI service (optional; complaint workflow must work without it):

```bash
cd ai-service
python -m venv .venv
# activate .venv for your OS
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Mobile (Flutter SDK required):

```bash
cd mobile
# Generate missing Android platform in a temporary folder so existing Dart files are safe:
flutter create --platforms=android --project-name clyra ../clyra_android_shell
# Copy ../clyra_android_shell/android into mobile/android (do not overwrite lib/)
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

**Before creating users:** `backend/.env` must contain a strong JWT secret and a reachable MongoDB URI. To create the first administrator set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` temporarily in `.env` and run `npm run bootstrap-admin`, then remove those values. Do not check `.env` into Git. Registration is disabled by default until campus policy is approved.

When using the Android emulator, `10.0.2.2` refers to the host PC. For a physical phone use the host LAN IP and an appropriate secure development networking setup.

## Tests

`npm test` in `backend/`, `pytest` in `ai-service/`, `flutter test` in `mobile/`, `npm run build` in `web/`. Actual command results are in `docs/testing/RESULTS.md`; no tests are claimed to pass without running.

## Configuration

The email provider, Cloudinary, Firebase Admin and model artifacts are not in this repo. Configuration requirements and open policies are documented in `docs/decisions/PENDING.md`. Never use localhost HTTP for production.
