# Eight-phase development tracking and rough effort estimates

The blueprint specifically requires incremental implementation, review and acceptance for each phase. These are planning ranges, not a promise of completed functionality or release dates. Assumed workload 4 focused hours/day for one developer with dependencies available.

| Phase | Estimated focus days | Estimated effort hours | Acceptance gate |
|---|---:|---:|---|
| 1. Requirements/design | 3–5 | 12–20 | Owner signs scope, roles, policies |
| 2. Backend/database | 12–18 | 48–72 | Auth, RBAC, complaints and assignments verified |
| 3. React web | 10–15 | 40–60 | Admin/faculty/staff flows integrated and accessible |
| 4. Flutter Android | 10–15 | 40–60 | Student/staff same-API workflows on device |
| 5. AI | 8–15 | 32–60 | Reviewed dataset and held-out evaluation |
| 6. Communication/advanced | 5–9 | 20–36 | FCM, announcements, feedback, evidence verified |
| 7. Security/testing | 8–15 | 32–60 | E2E, failures, RBAC, performance, accessibility |
| 8. Deployment/report | 5–9 | 20–36 | Reproducible production deployment and MCA demo |

Approximate total **61–101 focused days / 244–404 hours** excluding data collection, campus approvals, and external delays. Several tasks can overlap when dependencies are ready, but verification remains mandatory.
