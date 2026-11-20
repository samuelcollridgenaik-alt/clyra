# Clyra REST API — implementation snapshot

**Base:** `/api/v1` on the **Node/Express** backend. Only `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, and `/health` can be called without an access JWT (registration disabled by default). Roles: `STUDENT`, `FACULTY`, `STAFF`, `ADMIN`. Admin is not an implicit bypass for every staff-only state transition.

## Envelopes

Success (JSON): `{ "success": true, "message": "OK", "data": {}, "meta": {} }`.
Error (JSON): `{ "success": false, "message": "...", "code": "FORBIDDEN", "errors": [], "requestId": "..." }`.
Possible status codes: 400 bad input, 401 unauthenticated, 403 scope or policy forbidden, 404 missing, 409 conflict, 413 oversized payload, 429 rate limited, 500 server, 503 missing external configuration. CSV report export returns `text/csv` rather than JSON. List endpoints default to page=1, limit=20 (max 100), and return `meta.page`, `meta.limit`, `meta.total` when implemented.

`Authorization: Bearer <15-minute-JWT>` on protected endpoints. The browser refresh token is an HttpOnly/Secure-in-production/SameSite=Strict cookie scoped to `/api/v1/auth`. Android sends its stored refresh token to `/auth/refresh` with `X-Client: mobile`, securing it in encrypted platform storage. No token belongs in a public URL or Git repository.

| Method | Endpoint | Access | Input / notes |
|---|---|---|---|
| POST | `/auth/register` | Public if policy enabled | `fullName,email,password,registrationId?`; student only |
| POST | `/auth/login` | Public | `email,password` |
| POST | `/auth/refresh` | Refresh token | Cookie or JSON `refreshToken` |
| POST | `/auth/logout` | Refresh token | Revokes refresh hash |
| GET | `/auth/me` | Any authenticated | Current user |
| GET / PATCH | `/users/me` | Authenticated | Profile edits: name/phone/course/designation |
| GET / POST | `/users` | Admin | List paginated; create staff/faculty/student accounts |
| GET / PATCH | `/users/:id` | Admin | View/update scoped account fields |
| PATCH | `/users/:id/status` | Admin | `{isActive:boolean}` |
| GET | `/capabilities` | Authenticated | `mediaUploads,textOnlyResolution,passwordReset`; clients must not assume providers are configured |
| GET | `/complaints/summary` | Role-scoped | Actual totals for the current user's allowed complaint scope |
| GET / POST | `/complaints` | GET role-scoped; POST student/faculty/admin | Title, description, locationId, optional category |
| GET / PATCH | `/complaints/:id` | Owner/assigned staff/admin read; owner SUBMITTED edits | Ownership strictly enforced |
| GET | `/complaints/:id/history` | Owner/assigned staff/admin | Append-only timeline |
| POST | `/complaints/:id/review` | Admin | `decision:APPROVE/REJECT`, reason for reject, optional override+reason |
| POST | `/complaints/:id/assign` | Admin | `departmentId,assignedTo,reason?` |
| POST | `/complaints/:id/verify-resolution` | Admin | `accepted:true` to resolve, false and reason to return to work |
| POST | `/complaints/:id/reopen` | Admin | Mandatory `reason` |
| POST | `/complaints/:id/duplicate-decision` | Admin | `candidateId,decision:CONFIRM/DISMISS` |
| GET / POST | `/departments` | GET authenticated, POST admin | Name/code/contact |
| GET / PATCH | `/departments/:id` | GET authenticated, PATCH admin | Prevent deleting references; status endpoint deactivates |
| PATCH | `/departments/:id/status` | Admin | `{isActive:boolean}` |
| GET / POST | `/locations` | GET authenticated, POST admin | Campus→building→floor→room hierarchy |
| GET | `/locations/catalog` | Authenticated | Complete flat catalog, full `pathName`, `isAvailable`; non-admin sees only active valid ancestry |
| POST | `/locations/campus-layout` | Admin | `{campusId,blocks:[{code:"D",floorCount:4}],includeGroundFloor:true}`; D–U codes, 4/5 total levels, explicit ground convention |
| GET / PATCH | `/locations/:id` | GET authenticated, PATCH admin | Prevent invalid parent types |
| PATCH | `/locations/:id/status` | Admin | `{isActive:boolean}`; active children block deactivation |
| GET | `/assignments` | Staff own, admin all | Paginated |
| GET | `/assignments/:id` | Staff assignee/admin | Membership check |
| POST | `/assignments/:id/accept` | Assigned staff | ASSIGNED→ACCEPTED |
| POST | `/assignments/:id/start` | Assigned staff | ACCEPTED→IN_PROGRESS |
| POST | `/assignments/:id/hold` | Assigned staff/admin | Mandatory reason |
| POST | `/assignments/:id/resume` | Assigned staff/admin | ON_HOLD→IN_PROGRESS |
| POST | `/assignments/:id/submit-resolution` | Assigned staff | `evidenceUrls` from authorized uploads |
| POST | `/assignments/:id/decline` | Staff | **403 until policy approved** |
| GET | `/notifications` | Authenticated own | Paginated |
| PATCH | `/notifications/:id/read` | Notification owner | Read only |
| PATCH | `/notifications/read-all` | Authenticated own | Marks all read |
| POST | `/devices/register` | Authenticated | FCM token; requires encryption key; no plaintext storage |
| DELETE | `/devices/:id` | Device owner | Unregister |
| POST | `/feedback` | Original complainant after resolved/closed | `complaintId,rating(1–5),comment?`; unique per complaint |
| GET | `/feedback/:complaintId` | Complaint reader | Returns one record |
| GET | `/announcements` | Role-scoped | Only eligible current announcements for non-admin |
| GET | `/announcements/:id` | Eligible role/admin | Access filtered |
| POST / PATCH | `/announcements[/:id]` | Admin | Title, description, audience, publication |
| DELETE | `/announcements/:id` | Admin | Unpublishes; does not hard-delete |
| GET | `/analytics/dashboard` | Admin | Global counts, no fabricated values |
| GET | `/analytics/complaints` | Admin | Category/priority/status aggregates |
| GET | `/analytics/departments` | Admin | Grouped assignment counts |
| GET | `/analytics/locations` | Admin | Grouped issue counts |
| GET | `/analytics/trends` | Admin | Monthly issue aggregation |
| GET | `/analytics/reports` | Admin | JSON or `?format=csv`, capped at 10,000 records |
| POST | `/media/upload` | Authorized role | Multipart `file`, `resourceType`, `complaintId`; 5MB JPEG/PNG/WebP |
| DELETE | `/media/:id` | Unused media owner | Cloudinary config required |

**Internal FastAPI:** `/ai/health`, `/ai/model-info`, `/ai/classify`, `/ai/priority`, `/ai/duplicates`, `/ai/analyze`, `/ai/insights`. Protected inference endpoints require `X-AI-Service-Key`. React and Flutter MUST NOT call these endpoints. A missing model returns 503 or an explicit unavailable state; Node saves the complaint regardless.

## Contract limitations requiring follow-up

### Campus layout and health additions

`/locations/campus-layout` is transactional, additive and repeat-safe. The count is total levels: with `includeGroundFloor:true`, four means Ground + 1–3 and five means Ground + 1–4; false means Floors 1–4 or 1–5. Existing/manual records and complaint references are preserved. Conflicting/inactive/ambiguous matches produce HTTP 409 and roll back the entire layout. Lowering a count never deletes floors. New complaints reject invalid or inactive ancestor paths.

`GET /health/ready` is unauthenticated and outside `/api/v1`. It pings MongoDB and returns HTTP 200 `{status:"ready",service:"clyra-api",database:"connected"}` or HTTP 503 `{status:"not_ready",service:"clyra-api",database:"unavailable"}`. `/health` remains liveness only. Neither endpoint discloses credentials or connection errors.

Lifecycle operations that span complaint, assignment, history and audit writes require MongoDB transactions; a replica set is mandatory. Session logout revokes associated access, refresh rotation is single-use, and clients coalesce concurrent refresh requests.

### Remaining limitations

1. The core lifecycle and locations are tested against a local MongoDB replica set; production audit/UAT remain pending.
2. Cloudinary authenticated assets require a signed, scoped display/download access path before evidence previews are usable.
3. Location pickers now use the complete catalog, including entries beyond 100. Other list/report paging and server-side date filters still need follow-up.
4. Full campus policy settings, password-reset/email, FCM registration/testing, Android push permission handling, and institutional enrollment approval are not production complete.
5. Reassigning accepted/in-progress work is deferred pending an explicit approved state-machine policy.
6. Historic resolution performance metrics and analytics date filters need additional implementation and tests.
