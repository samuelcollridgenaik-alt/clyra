# Clyra agent instructions

Read `CLYRA_CODEX_MASTER_BLUEPRINT.docx` and `CLYRA_MASTER_SPEC.md` before modifying application code. The original DOCX is authoritative. Implement incremental, reviewable milestones. Do not alter required architecture: React JavaScript + Tailwind/Recharts web; Flutter/Dart Material 3 mobile; Node/Express shared REST API with Mongoose/MongoDB; private Python/FastAPI AI service. Do not use Firebase as application database.

Never expose secrets or private AI routes to clients. Enforce backend RBAC and object ownership; maintain append-only history. Never present AI suggestions as verified, never make autonomous rejection/resolution, never invent model metrics. No commits, pushes, deployments or destructive operations unless explicitly authorized. Document contracts and tests for each feature. Pending campus policy decisions are in `docs/decisions/PENDING.md`.

After work report objective, files, architecture/API/database changes, actual commands/results, missing configuration, next milestone, and approvals needed. A UI shell is not evidence of a functioning feature.
