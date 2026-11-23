# Clyra — Three-member collaboration guide

## Team and ownership

| Member | Register number | GitHub | Primary ownership | Branch |
| --- | --- | --- | --- | --- |
| Samuel Collridge Naik | 20252MCA0213 | @samuelcollridgenaik-alt | backend/, API contracts, database, ai-service/ coordination | dev/backend |
| Md Saheel Parwaz (Sahil) | 20252MCA0320 | @MdSaheelparwaz | web/ | dev/web |
| Shaik Roshan | 20252MCA0321 | @Roshanha01-web | mobile/ | dev/flutter |

One repository, one Express REST API, one MongoDB data model, two clients. Neither frontend connects directly to MongoDB or the private AI service.

## Before coding

1. Review README.md, AGENTS.md, CLYRA_MASTER_SPEC.md, and docs/api/CONTRACTS.md.
2. The existing `codex/issue-2-demo-ready` branch contains delivery work. The owner must review its PR and decide whether to merge it into main **before** developing from the current main. Do not assume the demo branch is merged.
3. Once the chosen baseline is on main, each member updates their development branch from main before starting new features.
4. Never commit .env files, passwords, database dumps, keystores, or generated build files.

## Individual setup

```bash
git clone https://github.com/samuelcollridgenaik-alt/clyra.git
cd clyra
git fetch origin
# Choose ONE branch:
git switch dev/backend   # Samuel
git switch dev/web       # Sahil
git switch dev/flutter   # Roshan
git pull --ff-only
```

If the project baseline has changed on main, update the assigned branch from main only after checking for uncommitted work and coordinating any conflicts.

## Daily workflow

Work primarily in your owned directory. For each feature, prefer a short-lived branch off your assigned development branch (e.g. `feat/web-complaint-filters`). Commit your own changes and push to GitHub. Open a pull request targeting your assigned dev branch for review. Once tested, open an integration pull request from the assigned dev branch to main.

Example:
```bash
git status
git add web/
git commit -m "feat(web): improve complaint filters"
git push -u origin HEAD
```

Do not blindly use `git add .` or force-push shared branches. Do not push directly to main. Keep pull requests small and include screenshots or test output where relevant.

## Integration rules

- Backend lead owns changes to API routes, authentication, authorization, schemas, and database migrations.
- Web and Flutter leads consume the documented API contract; proposed API changes require backend review.
- Shared docs, scripts, CI, configuration, and dependencies require coordination before editing.
- Pull requests affecting multiple components require review from each affected owner.
- Merge only when applicable checks pass and the integrated web + Flutter clients use the same backend.
- Each developer must use their own GitHub identity for commits so contributions are attributable.
- Local backend URLs differ across machines; configure them via environment/build configuration, never hardcode localhost for another device. Android emulator and physical devices may need different reachable addresses.
- The public web preview is not evidence of a hosted API. Deployment requires an HTTPS Express API and hosted MongoDB replica set.

## Verification

Backend:
```bash
npm ci --prefix backend
npm run check --prefix backend
npm test --prefix backend
```

Web:
```bash
npm ci --prefix web
npm test --prefix web
npm run build --prefix web
```

Flutter:
```bash
cd mobile
flutter pub get
flutter analyze --no-fatal-infos
flutter test
```

Run integration tests against an isolated test MongoDB database according to README.md. Do not use production or real student data.

## Definition of done

Every member must submit personally authored commits, at least one reviewed pull request, passing relevant tests, and a working demo of their component. For the final group demonstration, create a complaint on web, retrieve and update it on Flutter, and verify the same state and history through the shared backend.
