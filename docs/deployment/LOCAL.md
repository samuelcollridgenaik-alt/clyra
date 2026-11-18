# Setup and deployment constraints

## Development environment

1. Install Node.js >=20, npm, Python >=3.11 and MongoDB; Flutter SDK + Android toolchain for mobile.
2. Run `npm install` in `backend` and `web` and `pip install -r requirements.txt` in `ai-service`.
3. Copy each `.env.example` to `.env` and insert your own strong secrets. The repo contains no credentials.
4. Set `backend/MONGODB_URI` to MongoDB (Atlas or local). Use a MongoDB replica set when adding all-or-nothing multi-document transactions in a subsequent audited phase.
5. Create an initial admin through `backend/scripts/bootstrapAdmin.js`, after `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` have been provided temporarily. Remove bootstrap credentials afterward.
6. Configure departments and a campus/building/floor/room hierarchy before accepting student reports.
7. Run the Node API (`npm run dev`), AI service (`uvicorn app.main:app --reload --port 8000`), React (`npm run dev`) and Flutter (first generate Android platform in a temporary shell; see root README, then `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1`).
8. Set **different strong** `JWT_ACCESS_SECRET` and `AI_SHARED_SECRET`. Configure a 64-character hex `DEVICE_ENCRYPTION_KEY` only when FCM encrypted tokens are used. Configure `FIREBASE_SERVICE_ACCOUNT_JSON` only on server.
9. Upload images only after Cloudinary account, authenticated asset retrieval and campus privacy policy are approved.

## Production considerations

HTTPS for all endpoints; CORS allowlist; secure refresh cookie; MongoDB backups, Atlas IP/network rules; private Python AI service (not exposed to Internet); service-to-service authentication; structured log retention; email provider before password reset; Cloudinary signed evidence URLs; FCM push setup and Android consent/permissions; data access audit; user acceptance tests; accessibility, performance and recovery checks. None of these are verified production configurations at the time of writing.

**External credentials required:** MongoDB URI, Cloudinary cloud name/API key/secret, Firebase service account, separate JWT and AI service secrets, encryption key for stored device tokens, and approved campus user policy.
