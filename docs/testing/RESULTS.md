# Verification report · 20 November 2026

These are local observations, not claims of production readiness or a complete security audit.

| Check | Result |
|---|---|
| Backend `npm run check` | Passed |
| Backend `npm test` | 2 passed |
| Replica-set integration `npm run test:integration` | 16 passed, 0 failed |
| Web `npm test` | 10 passed, 0 failed |
| Web `npm run build` | Passed; large-chunk warning (~694 kB JS, ~196 kB gzip) |
| Packaging `node --test scripts/tests/*.test.mjs` | 2 passed |
| `flutter analyze --no-fatal-infos` | Passed; 4 existing deprecation infos, no errors/warnings |
| `flutter test --reporter expanded` | 20 passed |
| Android debug APK | Built locally |
| `node scripts/release-android.mjs --local-demo` | Branded release-mode APK built, 52.9 MB; explicitly development-signed; APK v2 signature verified |
| APK emulator install/launch | `adb install -r` succeeded; activity started; USB API forwarding configured |
| Local API readiness | HTTP 200, `ready` / `connected` |
| Local web | HTTP 200; browser rendered admin dashboard and D–U facilities editor with saved catalog |
| MongoDB Compass | Saved **Clyra Local Demo** connection; opened `clyra_demo` and observed application collections |

## Covered flows

- Isolated MongoDB complaint lifecycle, ownership/RBAC, session revocation, refresh-token replay rejection, assignment races and rollback after injected persistence failure.
- D–U four/five-level presets, both ground-floor conventions, repeated/concurrent application, manual location preservation, conflict rollback, inactive ancestry and catalogs over 100 entries.
- Client refresh coalescing and network errors; Flutter synchronous state updates, post-disposal completion, catalog search/retry/selection and complaint payload compatibility.
- An unconfigured hosted frontend refuses authentication requests without transmitting credentials to localhost.
- Public APK configuration rejects local/placeholder URLs; readiness validation matches the server contract.

Integration command used an isolated local replica-set database:
```sh
CLYRA_TEST_MONGODB_URI='mongodb://127.0.0.1:27019/clyra_ci_test_delivery20261120?replicaSet=clyra-dev' npm run test:integration
```
The suite cleans up that test database only. The intentional injected persistence failure logs an internal-error test message; its rollback test passed.

A new hosted-frontend guard initially rejected the test client's valid empty relative base. It was corrected to reject only null/unconfigured bases; all 10 web regressions then passed.

## Limitations

- No public backend exists: online login/complaint workflows cannot be verified. Vercel is a frontend-only preview until the API/database are hosted.
- APK is a local USB-connected demonstration, not a production-signed standalone build or Play Store submission. A physical-device walkthrough is still needed.
- Browser verification observed existing data and editor controls; no unconfirmed real campus floor map was applied.
- Cloudinary media/privacy, FCM delivery, password-reset email, real institutional policies and comprehensive accessibility/UAT remain unverified.
- AI service's earlier snapshot recorded five passing tests; it was not re-run in this delivery, and no trained-model metrics are claimed.
- GitHub Actions results must be checked on the delivery PR; local success is not a claim of remote CI success.
