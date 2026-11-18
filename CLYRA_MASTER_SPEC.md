# CLYRA — Master Project Blueprint

> Faithful machine-readable extraction from the original `CLYRA_CODEX_MASTER_BLUEPRINT.docx`. In case of extraction formatting differences, the DOCX remains authoritative.

CLYRA
AI-POWERED CAMPUS EXPERIENCE & OPERATIONS
MASTER PROJECT BLUEPRINT
& CODEX IMPLEMENTATION HANDOFF
System Architecture • Database • AI/ML • UI/UX • APIs • Security • Testing • Roadmap
MCA FINAL YEAR PROJECT  |  VERSION 1.0  |  17 NOVEMBER 2026

# How to use this document with Codex

Place this document in the root of the Clyra repository, or provide it to Codex as a project reference.
Ask Codex to read the complete specification before inspecting or changing project files.
Require Codex to inspect the repository and report its current state before implementation.
Use the initial Codex prompt in Section 18. Do not ask Codex to generate the entire application in one pass.
Keep this document as the product/architecture source of truth. Record approved changes explicitly.
Important: Mermaid diagrams are preserved as fenced Mermaid source blocks in this Word handoff. Codex can read and render or recreate them in repository documentation. The source Markdown remains the most convenient machine-readable companion if you want Codex to ingest the diagrams directly.
Project: Clyra
Tagline: AI-Powered Campus Experience & Operations
Project type: MCA Final Year Project
Document purpose: Single source of truth for AI coding agents, especially OpenAI Codex
Status: Architecture and planning baseline; implementation has not started
Version: 1.0
Date: 17 November 2026

# 0. Instructions to Codex — Read First

You are the senior software architect, technical lead, full-stack developer, Flutter developer, AI/ML engineer, QA engineer and documentation assistant for Clyra.
Your job is to help implement the project described in this document faithfully. Treat this document as the product and architecture source of truth unless the project owner explicitly approves a change.

## 0.1 Non-negotiable rules

Do not change the required technology stack.
React web and Flutter mobile must use the same Node.js/Express REST backend.
MongoDB is the central application database. Do not replace it with Firebase, PostgreSQL, Supabase or another database.
Keep AI processing in a separate Python/FastAPI service.
Do not connect React or Flutter directly to MongoDB.
Do not let either client call the private AI service directly. The Node backend orchestrates AI requests.
Enforce authentication, authorization and resource ownership on the backend. Hiding a button in the UI is not authorization.
AI predictions are suggestions. They must not silently make irreversible operational decisions.
Do not invent training data, model accuracy, benchmark results, deployed URLs, credentials, API responses or completed features.
Do not claim a feature works until it has been implemented and tested.
Do not start by generating the entire application in one operation.
Work in small, reviewable phases and preserve a working build.
Do not add unrelated ERP modules such as attendance, fees, examinations, hostel allocation or payroll.
Do not introduce unnecessary microservices, message brokers or infrastructure complexity.
Do not overwrite existing user work. Inspect the repository before editing.
Do not commit, push, deploy, delete data, or perform destructive operations unless the owner explicitly requests it.
Never put secrets in source code, documentation examples, Git history or client bundles.
When requirements conflict, stop and explain the conflict rather than silently choosing a new architecture.

## 0.2 First task when opening a repository

Before writing application code:
Inspect the existing repository, files, Git status and installed tool versions.
Identify whether the repository is empty, partially implemented or already contains work.
Read this specification and any AGENTS.md instructions.
Report the current state and any conflicts with this specification.
Propose a phased implementation plan and identify prerequisites.
Do not replace existing files or scaffold over existing work without approval.
If the owner has asked only for planning, remain in planning mode.

## 0.3 How to work

For each feature:
Explain the objective and user workflow.
Identify affected frontend, backend, database and AI components.
Define or confirm API contracts and validation.
Implement the smallest complete vertical slice.
Add tests.
Run formatting, static analysis, tests and relevant builds.
Report files changed, commands run, results, known limitations and next step.
Wait for review before making a large architectural change.
Prefer maintainable, understandable code suitable for an MCA final-year project and a student who must explain it during evaluation.

# 1. Product Overview

Clyra is an AI-assisted smart campus grievance and facility management platform. It centralizes campus issue reporting, complaint review, department assignment, maintenance task execution, progress tracking, evidence submission, notifications, feedback and operational analytics.
Students and faculty report campus problems. Administrators review reports and assign departments and staff. Department staff accept and perform assigned work, update progress and submit resolution evidence. The complainant can follow progress and provide feedback after resolution.
AI assists with:
Complaint category classification.
Complaint priority suggestion.
Similar/duplicate complaint detection.
Historical complaint analytics and operational insights.
The product consists of two client applications and two backend services:
React web application.
Flutter mobile application.
Node.js + Express main backend.
Python + FastAPI AI microservice.
Both clients use one shared REST API and one central MongoDB database.

## 1.1 Product objectives

Centralize campus complaint reporting.
Make complaint progress visible and traceable.
Route issues to appropriate departments.
Improve operational prioritization.
Detect potentially related complaints.
Reduce manual administrative effort.
Provide measurable department and location insights.
Support desktop and Android workflows.
Deliver a professional, modern SaaS-style experience.

## 1.2 Scope for initial release

Included:
Single-campus deployment.
Four user roles: Student, Faculty, Department Staff, Administrator.
Authentication and role-based access.
User profiles.
Complaint submission and tracking.
Image uploads.
AI category and priority suggestions.
Duplicate suggestions.
Departments and staff.
Assignments and status history.
Resolution evidence.
Notifications.
Feedback.
Announcements.
Locations/facilities.
Admin dashboard, analytics and reports.
Out of scope unless explicitly approved:
Fees and payments.
Attendance.
Examinations.
Hostel allocation.
Timetable management.
Full university ERP.
Autonomous emergency dispatch.
Autonomous AI rejection or closure.
Unnecessary chat/social networking features.

# 2. Required Technology Stack

Do not substitute technologies without explicit owner approval.

## 2.1 Web application

React.js
JavaScript (not TypeScript unless the owner approves a change)
Tailwind CSS
Recharts
Lucide icons
React Router for routing
A consistent API client layer
Form validation appropriate to the selected implementation

## 2.2 Main backend

Node.js
Express.js
REST APIs
JavaScript
Mongoose
JWT authentication
bcrypt password hashing
Request validation
Centralized error handling
Role-based access control

## 2.3 Database

MongoDB
MongoDB Atlas for hosted deployment, or local MongoDB during development
Mongoose schemas, indexes and references
MongoDB is the source of truth for application users, complaints, assignments, history, notifications, feedback, announcements and locations.

## 2.4 Mobile application

Flutter
Dart
Material 3
Android as the first mobile target
Secure token storage using an appropriate Flutter secure-storage package
Camera/gallery image selection
Firebase Cloud Messaging for push notifications
Do not use React Native.

## 2.5 AI service

Python
FastAPI
Scikit-learn
NLP preprocessing
TF-IDF
Logistic Regression as an initial classification baseline
Sentence Transformers
Cosine similarity
Pandas and appropriate evaluation utilities
AI inference is a separate service. Node.js remains responsible for authorization, business rules, persistence and client-facing API responses.

## 2.6 External services

Cloudinary: complaint and resolution image storage.
Firebase Cloud Messaging: mobile push notifications.
Git and GitHub: source control.
Postman: API testing.

## 2.7 Optional tooling

Cursor or another AI IDE may be used by the project owner.
OpenAI Codex is the coding agent.
Figma may be used for UI/UX design.
Docker may be introduced later if it makes local service orchestration easier.
Vercel may host the React frontend.
Render or another suitable host may host Node and Python services.
Do not make optional tooling a prerequisite for core functionality.

# 3. Architecture Principles

Use a modular monolith for the Node.js business backend.
Keep the Python AI service separate.
Use one central MongoDB database.
Keep API contracts consistent across React and Flutter.
Use server-side validation and authorization.
Use reusable UI components and shared design tokens.
Maintain an append-only status history and meaningful audit records.
Use pagination for list endpoints.
Use database indexes for common filters and lookups.
Use environment variables for secrets and service configuration.
Use predictable API response and error formats.
Keep the first release simple enough for an MCA student to build, test, deploy and explain.

## 3.1 High-level architecture


| flowchart TB;     subgraph CLIENTS["Client Applications"];         WEB["React Web Application"];         APP["Flutter Mobile Application"];     end;  ;     subgraph MAIN["Main Application Backend"];         API["Node.js + Express REST API"];         AUTH["JWT Authentication + RBAC"];         MODULES["Modular Business Services"];         MEDIA["Cloudinary Adapter"];         PUSH["FCM Notification Adapter"];         AICLIENT["AI Service Client"];     end;  ;     subgraph AI["Separate Python AI Service"];         FAST["FastAPI"];         CAT["Category Classifier"];         PRI["Priority Predictor"];         DUP["Duplicate Similarity"];         INS["Analytics / Insights"];     end;  ;     DB[("MongoDB")];     CLOUD["Cloudinary"];     FCM["Firebase Cloud Messaging"];  ;     WEB --> API;     APP --> API;     API --> AUTH;     AUTH --> MODULES;     MODULES --> DB;     MODULES --> MEDIA;     MODULES --> PUSH;     MODULES --> AICLIENT;     AICLIENT --> FAST;     FAST --> CAT;     FAST --> PRI;     FAST --> DUP;     FAST --> INS;     MEDIA --> CLOUD;     PUSH --> FCM;     FCM --> APP |
| --- |


## 3.2 Data flow for a complaint

Student or faculty submits complaint through React or Flutter.
Client sends request to Node/Express with authentication.
Backend validates user, fields, location and upload references.
Backend calls FastAPI for AI analysis when available and appropriate.
AI returns category, priority and possible duplicate suggestions with model metadata.
Backend validates the AI response and applies safety/business rules.
Backend persists the complaint and AI analysis in MongoDB.
Backend creates status history and notification records.
Administrator sees the complaint in the web application.
Administrator reviews AI suggestions and assigns a department and staff member.
Staff accepts and updates work through either supported client.
Backend records each permitted status transition.
Staff uploads resolution evidence through the backend/Cloudinary integration.
Authorized verification marks the complaint resolved.
Complainant receives notification and can submit feedback.

## 3.3 Service boundaries

React and Flutter only communicate with the Node REST API.
Node communicates with MongoDB through Mongoose.
Node calls FastAPI over a private or protected service-to-service connection.
FastAPI performs inference and returns structured results; it does not own the complaint lifecycle.
Node handles Cloudinary uploads or signed upload workflows and validates resulting asset references.
Node creates in-app notifications and triggers FCM.
FCM is a delivery mechanism, not the source of notification history.

# 4. User Roles and Authorization

Four roles are required.

## 4.1 Student

Responsibilities:
Register/login according to campus account policy.
Manage permitted profile fields.
Submit complaints.
Upload complaint photographs.
View own complaints only.
View own complaint timeline and updates.
Receive notifications and announcements.
Provide feedback on eligible resolved complaints.
Request reopening of an eligible complaint with a reason.
Restrictions:
Cannot see other students' private complaints.
Cannot assign staff or departments.
Cannot change official priority or status.
Cannot access administrative analytics.

## 4.2 Faculty

Responsibilities:
Login.
Submit complaints.
View own complaints.
Track status.
Receive notifications.
View announcements.
Provide feedback.
Restrictions:
Cannot see all complaints by default.
Cannot assign staff or manage departments.
Cannot access administrator-only analytics.

## 4.3 Department Staff

Responsibilities:
Login.
View tasks assigned to them.
Accept or decline according to assignment rules.
Start work.
Place work on hold with a reason.
Update progress.
Upload resolution evidence.
Submit work completion.
View work history.
Restrictions:
Cannot view unrelated users' private complaint records.
Cannot assign tasks to themselves or other staff unless explicitly authorized.
Cannot modify complaint ownership.
Cannot mark a complaint finally resolved unless the owner explicitly approves a verification policy granting this permission.

## 4.4 Administrator

Responsibilities:
Manage users and roles.
Review complaints.
Reject complaints with reasons.
Override AI category/priority with reason.
Manage departments and staff.
Assign and reassign work.
Manage facilities and locations.
Verify resolution.
Reopen complaints where appropriate.
Publish announcements.
View AI insights, reports and statistics.
Manage system configuration.

## 4.5 Authorization matrix


| Action | Student | Faculty | Staff | Admin |
| --- | --- | --- | --- | --- |
| Submit complaint | Yes | Yes | Optional policy | Yes |
| Read own complaint | Yes | Yes | If assigned | Yes |
| Read all complaints | No | No | No | Yes |
| Read assigned tasks | No | No | Yes | Yes |
| Change task progress | No | No | Assigned only | Yes |
| Upload resolution evidence | No | No | Assigned only | Yes |
| Manage departments | No | No | No | Yes |
| Manage staff | No | No | No | Yes |
| Manage locations | No | No | No | Yes |
| Publish announcements | No | No | No | Yes |
| View full analytics | No | No | Department-scoped if enabled | Yes |
| Submit feedback | Own eligible complaint | Own eligible complaint | No | Administrative correction only if audited |

All permissions must be enforced on the backend and tested with both allowed and denied cases.

# 5. Functional Modules


## 5.1 Authentication and authorization

Registration and login.
Logout.
Password hashing with bcrypt.
Short-lived access JWT.
Refresh-token lifecycle and revocation.
Account activation/deactivation.
Role and resource authorization.
Password reset flow only when an email provider/workflow is configured.
Do not store plaintext passwords or expose password hashes.

## 5.2 User/profile management

Fields include full name, email, phone, role, registration ID or employee ID, department, course/designation, profile image, active status and timestamps.
A user may update only permitted profile fields. Role, department assignment and account status are administrator-controlled.

## 5.3 Complaint management

Create complaint.
List complaints according to role scope.
View complaint details.
Edit only permitted fields and only in permitted states.
Upload images.
Filter and paginate.
Review and reject.
Assign and reassign.
Track status.
Reopen eligible complaints.
Maintain complaint code separate from MongoDB _id.
Suggested complaint code: CLY-2026-000125. Generate it safely so concurrent submissions cannot create duplicates.

## 5.4 AI classification

Predict one of the configured categories. Initial category list:
Electrical
Plumbing
Cleaning and Sanitation
Classroom Maintenance
Furniture
Internet and Networking
Security
Infrastructure
Other
Administrator can override the prediction. Save predicted and final values separately.

## 5.5 AI priority

Priority levels:
Critical
High
Medium
Low
Use historical labeled examples and structured features. Safety rules must prevent obvious safety reports from being silently downgraded. Administrator can override with an audit reason.

## 5.6 Duplicate detection

Generate semantic embeddings using Sentence Transformers.
Retrieve similar complaints.
Compare using cosine similarity.
Consider location and category in addition to text.
Return a small ranked list of candidates.
Treat results as suggestions, not confirmed duplicates.
Administrator confirms/dismisses relationship.
Do not automatically delete, reject or merge a complaint.

## 5.7 Department management

Department fields: name, code, description, contact email, contact phone, active status, timestamps.
Examples: Electrical Maintenance, Plumbing, Housekeeping, IT Support, Civil Maintenance and Security.
Use deactivation rather than deleting a department with historical references.

## 5.8 Staff assignment management

Assignment fields: complaint, department, assigned staff, assigned by, status, assigned time, accepted time, completed time, remarks and resolution evidence.
Support assignment, acceptance, reassignment and workload visibility.

## 5.9 Facility/location management

Hierarchy:
Campus → Building → Floor → Room / Common Area
Location fields: name, code, type, parent location, description and active status.
Validate that parent locations exist and prevent invalid cycles in the hierarchy.

## 5.10 Status tracking

Every status change creates a StatusHistory record with previous status, new status, actor, timestamp, remarks and optional evidence.
Never update or erase old history entries during normal operations.

## 5.11 Notifications

Events include complaint submission, review, rejection, assignment, acceptance, work progress, hold, resolution submission, resolution verification, reopening and announcements.
Store in-app notification records in MongoDB. Send FCM as an additional delivery channel. Notification failure must not corrupt the underlying complaint transaction.

## 5.12 Feedback

Rating 1–5.
Optional comment.
One feedback record per complaint.
Only original complainant can submit feedback.
Complaint must be eligible under the approved resolved/closed policy.

## 5.13 Announcements

Fields include title, description, image URL, audience roles, publisher, publish date, expiry date and published status.
Only administrators can publish in the initial release.

## 5.14 Admin dashboard and analytics

Display:
Total complaints.
Open complaints.
Critical complaints.
Resolved complaints.
Pending assignments.
Average resolution time.
Category distribution.
Department workload.
Location distribution.
Monthly trends.
Recent complaints and urgent issues.
Use server-side aggregation and date filters. Do not calculate global statistics from only the current page of client-side results.

# 6. Complaint Lifecycle and State Machine


## 6.1 Main lifecycle


| flowchart TD;     A["Student / Faculty submits"];     B["Backend validation"];     C["AI analysis"];     D["Duplicate suggestions"];     E["Persist complaint"];     F["Admin review"];     G{"Approved?"};     H["Rejected with reason"];     I["Assign department and staff"];     J["Staff accepts"];     K["In progress"];     L["Upload resolution evidence"];     M["Resolution submitted"];     N["Admin verifies"];     O{"Accepted?"};     P["Return to work / reopen"];     Q["Resolved"];     R["Notify complainant"];     S["Feedback"];  ;     A --> B --> C --> D --> E --> F --> G;     G -->\|No\| H;     G -->\|Yes\| I --> J --> K --> L --> M --> N --> O;     O -->\|No\| P --> K;     O -->\|Yes\| Q --> R --> S |
| --- |


## 6.2 Complaint statuses

SUBMITTED: received by backend.
UNDER_REVIEW: awaiting administrator review.
REJECTED: rejected with mandatory reason.
ASSIGNED: department/staff assignment created.
ACCEPTED: assigned staff accepted.
IN_PROGRESS: work started.
ON_HOLD: work paused with reason.
RESOLUTION_SUBMITTED: staff submitted completion evidence.
RESOLVED: resolution verified.
REOPENED: issue reopened with reason.
CLOSED: lifecycle closed under approved policy.
Use stable enum values internally; display human-friendly labels in clients.

## 6.3 Transition policy


| From | To | Actor |
| --- | --- | --- |
| SUBMITTED | UNDER_REVIEW | Admin/system review workflow |
| UNDER_REVIEW | ASSIGNED | Admin |
| UNDER_REVIEW | REJECTED | Admin |
| ASSIGNED | ACCEPTED | Assigned staff |
| ACCEPTED | IN_PROGRESS | Assigned staff |
| IN_PROGRESS | ON_HOLD | Assigned staff/admin |
| ON_HOLD | IN_PROGRESS | Assigned staff/admin |
| IN_PROGRESS | RESOLUTION_SUBMITTED | Assigned staff |
| RESOLUTION_SUBMITTED | RESOLVED | Authorized verifier/admin |
| RESOLUTION_SUBMITTED | IN_PROGRESS | Admin return for further work |
| RESOLVED | REOPENED | Original complainant/admin under policy |
| REOPENED | ASSIGNED | Admin |
| RESOLVED | CLOSED | Admin/system under approved policy |

Validate every transition server-side. Require reasons for rejection, hold, override, reassignment and reopening as appropriate.
Keep assignment status separate from complaint status where needed. A complaint can have multiple historical assignment records.

# 7. MongoDB Data Model

Database name: clyra_db.
Use Mongoose references for core relationships. Define timestamps, validation and indexes. Avoid duplicating large documents unnecessarily.

## 7.1 Users


| Field | Type | Required |
| --- | --- | --- |
| _id | ObjectId | Yes |
| fullName | String | Yes |
| email | String | Yes |
| passwordHash | String | Yes |
| phone | String | No |
| role | Enum String | Yes |
| registrationId | String | No |
| employeeId | String | No |
| departmentId | ObjectId ref Departments | No |
| course | String | No |
| designation | String | No |
| profileImage | String | No |
| isActive | Boolean | Yes |
| createdAt | Date | Yes |
| updatedAt | Date | Yes |

Indexes: unique normalized email; role; departmentId. Do not return passwordHash.

## 7.2 Complaints


| Field | Type | Required |
| --- | --- | --- |
| _id | ObjectId | Yes |
| complaintCode | String | Yes |
| title | String | Yes |
| description | String | Yes |
| submittedBy | ObjectId ref Users | Yes |
| category | Enum String | Yes |
| predictedCategory | String | No |
| categoryConfidence | Number | No |
| priority | Enum String | Yes |
| predictedPriority | String | No |
| priorityConfidence | Number | No |
| status | Enum String | Yes |
| locationId | ObjectId ref Locations | Yes |
| imageUrls | Array of Strings | No |
| departmentId | ObjectId ref Departments | No |
| duplicateOf | ObjectId ref Complaints | No |
| aiAnalysis | Subdocument | No |
| createdAt | Date | Yes |
| updatedAt | Date | Yes |

aiAnalysis may include model version, analysis timestamp, model status and ranked duplicate candidates. Store only validated AI output. Consider keeping prediction/override audit details in a dedicated audit/history record.
Indexes:
Unique complaintCode.
{ status: 1, priority: 1 }.
{ submittedBy: 1, createdAt: -1 }.
{ departmentId: 1, status: 1 }.
{ locationId: 1, category: 1 }.
Additional indexes only after observing actual query patterns.

## 7.3 Departments

Fields: _id, name, code, description, contactEmail, contactPhone, isActive, timestamps.
Indexes: unique code; normalized name.

## 7.4 Assignments

Fields:
_id
complaintId (ObjectId ref Complaints)
departmentId (ObjectId ref Departments)
assignedTo (ObjectId ref Users)
assignedBy (ObjectId ref Users)
assignmentStatus
assignedAt
acceptedAt
completedAt
remarks
resolutionEvidence (array of evidence objects)
Indexes: complaintId/status; assignedTo/status; departmentId/assignedAt.

## 7.5 StatusHistory

Fields:
_id
complaintId
previousStatus
newStatus
updatedBy
remarks
evidenceUrls
createdAt
Index: { complaintId: 1, createdAt: 1 }.
Treat as append-only through application workflows.

## 7.6 Notifications

Fields: _id, userId, title, message, type, optional complaintId, isRead, createdAt.
Indexes: { userId: 1, createdAt: -1 }; { userId: 1, isRead: 1 }.

## 7.7 Feedback

Fields: _id, complaintId, submittedBy, rating, comment, createdAt.
Validation: rating integer 1–5; one feedback per complaint; verify complainant ownership and eligibility in backend.
Index: unique complaintId.

## 7.8 Announcements

Fields: _id, title, description, imageUrl, audience array, publishedBy, publishAt, expiresAt, isPublished, createdAt.
Indexes: { isPublished: 1, publishAt: -1 }; expiresAt where useful.

## 7.9 Locations

Fields: _id, name, code, type, parentLocationId, description, isActive.
Types: CAMPUS, BUILDING, FLOOR, ROOM, COMMON_AREA.
Indexes: parentLocationId; type; code where supplied.

## 7.10 Supporting collections recommended


### Sessions / RefreshTokens

Store user ID, hashed refresh token, expiry, revocation timestamp, device/session metadata and timestamps. Never store raw refresh tokens.

### AuditLogs

Store actor, action, resource type, resource ID, timestamp, safe metadata and request correlation ID. Never log passwords, raw tokens or secrets.

### ComplaintEmbeddings (if needed)

Store complaint reference, embedding/model identifier, creation time and vector representation or reference to a vector index. Keep embedding implementation replaceable.

## 7.11 ER-style relationships


| erDiagram;     USERS \|\|--o{ COMPLAINTS : submits;     USERS \|\|--o{ ASSIGNMENTS : assigned_to;     USERS \|\|--o{ ASSIGNMENTS : assigned_by;     USERS \|\|--o{ STATUS_HISTORY : updates;     USERS \|\|--o{ NOTIFICATIONS : receives;     USERS \|\|--o{ FEEDBACK : submits;     DEPARTMENTS \|\|--o{ USERS : contains;     DEPARTMENTS \|\|--o{ ASSIGNMENTS : handles;     COMPLAINTS \|\|--o{ ASSIGNMENTS : assigned_through;     COMPLAINTS \|\|--o{ STATUS_HISTORY : has;     COMPLAINTS \|\|--o\| FEEDBACK : receives;     LOCATIONS \|\|--o{ COMPLAINTS : identifies;     LOCATIONS \|\|--o{ LOCATIONS : contains;     USERS \|\|--o{ ANNOUNCEMENTS : publishes |
| --- |


# 8. AI Service Specification


## 8.1 General rules

AI service is Python + FastAPI.
Node backend is the only application service that calls AI endpoints.
Protect service-to-service communication with an internal secret or suitable network policy.
Add timeouts, retries only where safe, and clear failure handling.
AI outage must not corrupt core complaint data.
Store model version and analysis timestamp.
Do not invent model metrics.
Never train on unreviewed labels without a controlled dataset process.
Keep model training separate from online inference.

## 8.2 Classification

Initial baseline:
Collect labeled complaint examples.
Review label consistency and class balance.
Split data without leakage.
Preprocess text conservatively.
Convert text to TF-IDF features.
Train Logistic Regression baseline.
Evaluate using precision, recall, F1 and confusion matrix.
Save model and vectorizer with version metadata.
Expose inference endpoint.
Preserve negation and meaningful terms. Avoid overly aggressive stop-word removal.
Response should include predicted category, confidence/probability if appropriately calibrated, model version and inference metadata. Confidence must not be represented as accuracy.

## 8.3 Priority prediction

Initial candidate: Logistic Regression or Random Forest using text and structured features. Train only when historical examples have reviewed priority labels.
Features may include complaint text, category, location type, safety indicators and reported impact. Use macro F1, per-class recall and confusion matrix. Critical safety rules must be explicit and tested. Admin override requires reason and audit trail.

## 8.4 Duplicate detection

Sentence Transformers generates semantic embeddings.
Use cosine similarity to rank candidates.
Filter or boost candidates using location/category/time context.
Return top candidates and raw similarity scores.
Select threshold through validation, not guesswork.
Similarity score is not a probability of duplication.
Administrator confirms/dismisses.
Never auto-delete or auto-reject.
For a small initial dataset, a simple persisted/in-memory comparison may be adequate. Consider a vector index only when justified by scale and deployment support.

## 8.5 Analytics

Start with deterministic MongoDB aggregation and descriptive statistics:
Recurring categories.
Location hotspots.
Department workload.
Monthly complaint counts.
Resolution-time distribution.
Priority distribution.
Add forecasting only if there is sufficient clean historical data and it can be evaluated honestly. Label generated observations with date range, data basis and limitations.

## 8.6 Suggested FastAPI endpoints


| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /ai/health | Health check |
| GET | /ai/model-info | Model metadata |
| POST | /ai/classify | Category prediction |
| POST | /ai/priority | Priority prediction |
| POST | /ai/duplicates | Similar complaint retrieval |
| POST | /ai/analyze | Combined analysis |
| POST | /ai/insights | Analytics insights |

Example request:

| {;   "title": "Water leakage in classroom",;   "description": "Water is leaking from the ceiling in room 204.",;   "locationId": "location_object_id"; } |
| --- |

Example response shape (illustrative contract only; not a real prediction):

| {;   "classification": {;     "category": "Plumbing",;     "confidence": null;   },;   "priority": {;     "level": "High",;     "confidence": null;   },;   "duplicates": [],;   "modelVersion": "initial-model",;   "analyzedAt": null; } |
| --- |


# 9. UI/UX Design System

Clyra must look like a professional modern SaaS product, not a generic student CRUD project.

## 9.1 Brand identity

Brand: Clyra
Tagline: AI-Powered Campus Experience & Operations
Primary: Deep Navy #172B50
Secondary: Indigo #6657D9
Accent: Teal #14B8A6
Background: Soft White #F7F9FC
Card: White #FFFFFF
Border: subtle cool gray such as #E5EAF1
Typography: Inter preferred; Poppins alternative
Icons: Lucide on web; Material-compatible icons on Flutter
Semantic colors:
Critical: red.
High: orange.
Medium: amber.
Low: blue.
Resolved: green.
In progress: indigo.
Pending: gray.
Use accessible contrast and do not rely on color alone to communicate status.

## 9.2 Web layout principles

Desktop sidebar approximately 240–260 px.
Header approximately 64–72 px.
Main content flexible.
Card radius 12–16 px.
Consistent 8 px spacing scale.
Responsive desktop, tablet and mobile layouts.
Collapsible sidebar on tablet; drawer on narrow screens.
Reusable tables, filters, status chips, dialogs and form controls.
Loading, empty, error and success states for every data-driven page.

## 9.3 Administrator web screens

Login.
Dashboard.
Complaint Management.
Complaint Details.
Department Management.
Staff Management.
Campus Facility/Location Management.
AI Insights.
Analytics and Reports.
Announcements.
Settings.
Profile.

### Admin dashboard

KPI cards:
Total complaints.
Pending/open complaints.
Critical complaints.
Resolved complaints.
Charts:
Complaint trends.
Category distribution.
Department workload.
Location-wise issue distribution.
Tables/lists:
Recent complaints.
Critical complaints.
Pending assignments.

### Complaint management

Filters:
Search complaint ID/title.
Category.
Priority.
Department.
Status.
Date range.
Table:
Complaint ID.
Title.
Category.
Priority.
Department.
Status.
Submitted date.
Actions.

### Complaint detail

Show:
Complaint details and images.
Complainant information according to permission.
Location.
AI predictions and model metadata.
Duplicate candidates.
Department/staff assignment.
Status timeline.
Audit/activity history.
Actions:
Approve/review.
Reject with reason.
Change category/priority with audit reason.
Assign/reassign.
Verify resolution.
Reopen where authorized.

### Departments/staff/facilities

Provide clear management tables, add/edit forms, active state, workload summaries and safe deactivation. Facility management uses the campus/building/floor/room hierarchy.

### AI insights and reports

Show:
Recurring issue cards.
Category distribution.
Department workload.
Monthly trends.
Location hotspots.
Date range and data basis for each insight.
CSV export initially.

## 9.4 Faculty web screens

Dashboard.
Report Complaint.
My Reports.
Complaint Details.
Notifications.
Profile.
Dashboard: welcome area, own complaint KPIs, recent reports and a prominent report action.

## 9.5 Staff web screens

Dashboard.
Assigned Tasks.
Task Details.
Update Work Status.
Upload Resolution Evidence.
Work History.
Profile.
Prioritize task location, complaint description, priority, assignment time, instructions and status actions.

## 9.6 Flutter student screens

Splash.
Onboarding.
Login.
Registration.
Home Dashboard.
Report Complaint.
AI Analysis Preview.
My Complaints.
Complaint Details.
Complaint Tracking.
Notifications.
Announcements.
Profile.
Settings.
Student home:
Greeting.
Notification action.
Prominent Report Issue action.
Complaint summary cards.
Recent complaints.
Latest announcements.
Bottom navigation:
Home.
My Complaints.
Notifications.
Profile.
Report action may be a floating action button or prominent primary action.
Complaint form:
Title.
Description.
Optional user category.
Location selector.
Image picker.
Submit.
AI preview:
Predicted category.
Suggested priority.
Possible duplicates.
Explanation that suggestions are AI-generated.
Continue/submit action.

## 9.7 Flutter staff screens

Login.
Dashboard.
Assigned Tasks.
Task Details.
Update Status.
Upload Evidence.
Work History.
Profile.
Bottom navigation:
Home.
Tasks.
History.
Profile.
Use Material 3, comfortable touch targets (approximately 48 logical pixels minimum), responsive text, accessible labels and clear loading/error states.

## 9.8 Wireframe guidance

Admin dashboard structure:

| +--------------------------------------------------------------+; \| CLYRA \| Search                         Notifications Profile  \|; +------------------+-------------------------------------------+; \| Overview         \| Overview                                  \|; \| Complaints       \| [Total] [Open] [Critical] [Resolved]      \|; \| Departments      \|                                           \|; \| Staff            \| [Complaint Trend Chart] [Category Chart]  \|; \| Facilities       \|                                           \|; \| AI Insights      \| [Department Workload] [Location Chart]    \|; \| Analytics        \|                                           \|; \| Announcements    \| Recent Complaints Table                   \|; \| Reports          \|                                           \|; \| Settings         \|                                           \|; +------------------+-------------------------------------------+ |
| --- |

Student mobile structure:

| +---------------------------+; \| Clyra              Bell   \|; \| Hello, Student            \|; \|                           \|; \| [ Report a New Issue ]    \|; \|                           \|; \| My Complaints             \|; \| [ Total ]       [ Active ]\|; \|                           \|; \| Recent Complaints         \|; \| [Complaint card/status]   \|; \|                           \|; \| Latest Announcements     \|; \| [Announcement card]       \|; +---------------------------+; \| Home Reports Alerts Profile\|; +---------------------------+ |
| --- |

Do not hardcode sample user names or fabricated statistics in production UI. Use clearly marked mock data only during design and development.

# 10. Navigation


## 10.1 Admin web sidebar

Overview
Complaints
Departments
Staff Management
Facilities
AI Insights
Analytics & Reports
Announcements
Settings
Profile (usually in account menu)

## 10.2 Faculty web navigation

Dashboard
Report Complaint
My Reports
Notifications
Profile

## 10.3 Staff navigation

Dashboard
Assigned Tasks
Work History
Notifications
Profile

## 10.4 Student Flutter navigation

Bottom bar:
Home
My Complaints
Notifications
Profile
Other screens:
Report Complaint
AI Preview
Complaint Details
Tracking
Announcements
Settings

## 10.5 Staff Flutter navigation

Bottom bar:
Home
Tasks
History
Profile
Navigation visibility must be role-driven, but route guards and backend authorization remain mandatory.

# 11. REST API Contract Plan

Use a consistent base prefix, for example /api/v1. Exact endpoint naming may be refined once, then documented and used consistently by React and Flutter.
All protected endpoints require a valid access token unless explicitly marked public. Enforce role and resource scope in the backend.
Use a consistent response envelope, for example:

| {;   "success": true,;   "message": "Human-readable message",;   "data": {},;   "meta": {}; } |
| --- |

Use a consistent error envelope:

| {;   "success": false,;   "message": "Validation failed",;   "code": "VALIDATION_ERROR",;   "errors": []; } |
| --- |

Do not expose stack traces, secrets or database internals in production responses.

## 11.1 Authentication


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| POST | /api/v1/auth/register | Register eligible user | Public/registration policy |
| POST | /api/v1/auth/login | Authenticate | Public |
| POST | /api/v1/auth/refresh | Refresh access token | Refresh token |
| POST | /api/v1/auth/logout | Revoke session | Authenticated |
| GET | /api/v1/auth/me | Current user | Authenticated |
| POST | /api/v1/auth/forgot-password | Start reset flow | Public, only when configured |
| POST | /api/v1/auth/reset-password | Complete reset | Reset token |


## 11.2 Users


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/users/me | Own profile | Authenticated |
| PATCH | /api/v1/users/me | Update permitted profile fields | Authenticated |
| GET | /api/v1/users | List users | Admin |
| GET | /api/v1/users/:id | View user | Admin or permitted scoped access |
| POST | /api/v1/users | Create staff/faculty account if policy requires | Admin |
| PATCH | /api/v1/users/:id | Update account/role/status | Admin |
| PATCH | /api/v1/users/:id/status | Activate/deactivate | Admin |


## 11.3 Complaints


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| POST | /api/v1/complaints | Create complaint | Student/Faculty/Admin |
| GET | /api/v1/complaints | List permitted complaints | Role-scoped |
| GET | /api/v1/complaints/:id | Complaint details | Owner/assigned staff/Admin |
| PATCH | /api/v1/complaints/:id | Update permitted fields | Policy-scoped |
| POST | /api/v1/complaints/:id/review | Approve/reject review | Admin |
| POST | /api/v1/complaints/:id/assign | Assign department/staff | Admin |
| POST | /api/v1/complaints/:id/reopen | Reopen with reason | Owner/Admin policy |
| POST | /api/v1/complaints/:id/verify-resolution | Verify resolution | Admin/authorized verifier |
| GET | /api/v1/complaints/:id/history | Status timeline | Owner/assigned staff/Admin |

List endpoints must support pagination and appropriate filters. Never return all complaints to a normal student/faculty account.

## 11.4 Departments


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/departments | List departments | Authenticated as policy permits |
| POST | /api/v1/departments | Create department | Admin |
| GET | /api/v1/departments/:id | Department details | Authenticated as policy permits |
| PATCH | /api/v1/departments/:id | Update department | Admin |
| PATCH | /api/v1/departments/:id/status | Activate/deactivate | Admin |


## 11.5 Assignments


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/assignments | List permitted assignments | Staff/Admin |
| GET | /api/v1/assignments/:id | Assignment detail | Assigned staff/Admin |
| POST | /api/v1/assignments/:id/accept | Accept task | Assigned staff |
| POST | /api/v1/assignments/:id/decline | Decline with reason, if policy allows | Assigned staff |
| POST | /api/v1/assignments/:id/start | Start work | Assigned staff |
| POST | /api/v1/assignments/:id/hold | Pause with reason | Assigned staff/Admin |
| POST | /api/v1/assignments/:id/resume | Resume | Assigned staff/Admin |
| POST | /api/v1/assignments/:id/submit-resolution | Submit evidence/completion | Assigned staff |


## 11.6 Notifications


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/notifications | Own notifications | Authenticated |
| PATCH | /api/v1/notifications/:id/read | Mark one read | Owner |
| PATCH | /api/v1/notifications/read-all | Mark all read | Authenticated |
| POST | /api/v1/devices/register | Register FCM device token | Authenticated |
| DELETE | /api/v1/devices/:id | Remove device token | Owner |


## 11.7 Feedback


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| POST | /api/v1/feedback | Submit rating/comment | Original complainant, eligible complaint |
| GET | /api/v1/feedback/:complaintId | View feedback | Owner/Admin according to policy |


## 11.8 Announcements


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/announcements | List published audience-eligible items | Authenticated |
| GET | /api/v1/announcements/:id | View announcement | Eligible audience |
| POST | /api/v1/announcements | Create announcement | Admin |
| PATCH | /api/v1/announcements/:id | Edit announcement | Admin |
| DELETE | /api/v1/announcements/:id | Delete/unpublish according to policy | Admin |

Prefer archive/unpublish where historical auditability matters.

## 11.9 Locations/facilities


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/locations | List active locations | Authenticated |
| POST | /api/v1/locations | Create location | Admin |
| GET | /api/v1/locations/:id | Location details | Authenticated |
| PATCH | /api/v1/locations/:id | Update location | Admin |
| PATCH | /api/v1/locations/:id/status | Activate/deactivate | Admin |


## 11.10 Analytics


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | /api/v1/analytics/dashboard | Admin dashboard summary | Admin |
| GET | /api/v1/analytics/complaints | Complaint statistics | Admin |
| GET | /api/v1/analytics/departments | Department workload | Admin |
| GET | /api/v1/analytics/locations | Location issue statistics | Admin |
| GET | /api/v1/analytics/trends | Monthly trends | Admin |
| GET | /api/v1/analytics/reports | Report data/export | Admin |


## 11.11 Media


| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| POST | /api/v1/media/upload | Upload validated image | Authenticated, role/context checked |
| DELETE | /api/v1/media/:id | Delete eligible unused asset | Authorized owner/Admin |

Use a documented upload flow. Validate file size, MIME type and actual file content. Do not trust filename extensions alone.

## 11.12 AI service endpoints

These are internal service-to-service endpoints, not public client APIs.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /ai/health | Health |
| GET | /ai/model-info | Model metadata |
| POST | /ai/classify | Classification |
| POST | /ai/priority | Priority prediction |
| POST | /ai/duplicates | Similarity retrieval |
| POST | /ai/analyze | Combined analysis |
| POST | /ai/insights | Analytics insight generation |

For every endpoint, Codex must document request schema, response schema, authentication, role scope, validation, error codes and pagination where applicable before implementation.

# 12. Security Architecture


## 12.1 Authentication

bcrypt password hashing with appropriate work factor.
Short-lived JWT access tokens.
Refresh-token rotation and revocation.
Secure storage on mobile.
Avoid localStorage for sensitive long-lived credentials where a safer web strategy is feasible.
Validate token issuer, audience, expiry and signature.
Logout must revoke refresh session.

## 12.2 Authorization

Role-based middleware.
Resource ownership checks.
Assignment membership checks.
Department scope checks.
Admin-only operations.
Field-level update allowlists.
Never trust role, user ID, department ID or ownership supplied by client.

## 12.3 Input validation

Validate:
Required fields.
Length limits.
Enum values.
MongoDB ObjectId format.
Date ranges.
Pagination limits.
Uploaded file metadata.
Cross-field consistency.
Use safe MongoDB query construction; prevent NoSQL injection.

## 12.4 API protection

Rate limiting on login, registration, password reset and sensitive endpoints.
CORS allowlist.
Helmet/security headers.
Request size limits.
Centralized error handler.
Request IDs and structured logs.
HTTPS in deployed environments.
Dependency updates and vulnerability checks.

## 12.5 File upload security

Allow only approved image formats.
Validate actual content/MIME, not just extension.
Enforce file-size limits.
Use generated asset names.
Use Cloudinary transformations where appropriate.
Avoid public exposure of private evidence where privacy requires restricted access.
Verify that the user is authorized to attach evidence to the relevant complaint/assignment.

## 12.6 Secrets

Environment variables or managed secret storage for:
MongoDB URI.
JWT secrets.
Refresh token secrets if separate.
Cloudinary credentials.
Firebase service credentials.
AI service shared secret.
Allowed CORS origins.
Commit only .env.example with placeholder values. Never commit .env.

## 12.7 Auditability

Audit:
Role changes.
Account deactivation.
Complaint rejection.
Priority/category override.
Assignment and reassignment.
Status changes.
Resolution verification.
Reopening.
Administrative changes.
Do not log passwords, tokens or sensitive data unnecessarily.

# 13. Project Repository and Folder Structure

Recommended monorepo for a single student/team to manage. If the owner already has separate repositories, preserve that arrangement rather than migrating without approval.

| clyra/; ├── AGENTS.md; ├── CLYRA_MASTER_SPEC.md; ├── README.md; ├── .gitignore; ├── docs/; │   ├── architecture/; │   ├── database/; │   ├── api/; │   ├── ui-ux/; │   ├── ai/; │   ├── testing/; │   ├── deployment/; │   └── decisions/; │; ├── web/; │   ├── public/; │   └── src/; │       ├── assets/; │       ├── components/; │       │   ├── common/; │       │   ├── layout/; │       │   ├── forms/; │       │   ├── charts/; │       │   └── complaints/; │       ├── features/; │       │   ├── auth/; │       │   ├── dashboard/; │       │   ├── complaints/; │       │   ├── departments/; │       │   ├── staff/; │       │   ├── facilities/; │       │   ├── analytics/; │       │   ├── announcements/; │       │   ├── notifications/; │       │   └── profile/; │       ├── hooks/; │       ├── lib/; │       ├── services/; │       ├── routes/; │       ├── context/; │       ├── utils/; │       ├── styles/; │       └── App.jsx; │; ├── mobile/; │   ├── android/; │   ├── assets/; │   ├── lib/; │   │   ├── core/; │   │   │   ├── config/; │   │   │   ├── constants/; │   │   │   ├── theme/; │   │   │   ├── network/; │   │   │   ├── storage/; │   │   │   ├── routing/; │   │   │   └── widgets/; │   │   ├── features/; │   │   │   ├── auth/; │   │   │   ├── home/; │   │   │   ├── complaints/; │   │   │   ├── tasks/; │   │   │   ├── notifications/; │   │   │   ├── announcements/; │   │   │   └── profile/; │   │   └── main.dart; │   └── test/; │; ├── backend/; │   ├── src/; │   │   ├── config/; │   │   ├── models/; │   │   ├── routes/; │   │   ├── controllers/; │   │   ├── services/; │   │   ├── repositories/; │   │   ├── middleware/; │   │   ├── validators/; │   │   ├── utils/; │   │   ├── integrations/; │   │   │   ├── ai/; │   │   │   ├── cloudinary/; │   │   │   └── firebase/; │   │   ├── jobs/; │   │   ├── app.js; │   │   └── server.js; │   └── tests/; │; ├── ai-service/; │   ├── app/; │   │   ├── api/; │   │   ├── core/; │   │   ├── schemas/; │   │   ├── preprocessing/; │   │   ├── models/; │   │   ├── inference/; │   │   ├── duplicate_detection/; │   │   ├── analytics/; │   │   └── main.py; │   ├── training/; │   ├── datasets/; │   │   ├── raw/; │   │   └── processed/; │   ├── artifacts/; │   └── tests/; │; └── scripts/;     └── development/ |
| --- |

Responsibilities:
docs/: architecture, decisions, API, database, UI, AI, testing and deployment documentation.
web/src/features/: feature-oriented React screens and components.
web/src/components/: reusable presentation components.
mobile/lib/core/: shared Flutter infrastructure, theme, network and routing.
mobile/lib/features/: feature-oriented Flutter code.
backend/src/models/: Mongoose schemas.
backend/src/controllers/: HTTP request/response handling.
backend/src/services/: business logic.
backend/src/repositories/: persistence/query abstractions where useful.
backend/src/middleware/: auth, RBAC, validation and error handling.
backend/src/integrations/: AI, Cloudinary and Firebase adapters.
ai-service/app/: FastAPI endpoints and inference logic.
ai-service/training/: controlled model training/evaluation.
ai-service/datasets/: datasets; never commit private personal data.
ai-service/artifacts/: versioned model artifacts according to repository size policy.
Do not create empty folders for every possible feature before they are needed. Scaffold incrementally.

# 14. Testing Strategy

Testing is required throughout development, not only at the end.

## 14.1 Authentication tests

Valid login.
Invalid password.
Unknown email.
Inactive account.
Expired access token.
Invalid refresh token.
Revoked refresh token.
Logout.
Password hash not exposed.

## 14.2 Role permission tests

For each endpoint test:
Allowed role succeeds.
Disallowed role receives 403.
Unauthenticated user receives 401.
User cannot access another user's complaint by changing ID.
Staff cannot access an unassigned task.
Department scope is enforced.

## 14.3 Complaint tests

Required fields.
Invalid location.
Invalid category.
Valid complaint submission.
Unique complaint code under concurrent requests.
Image validation.
Pagination and filters.
Ownership access.
Rejection reason required.
Valid/invalid state transitions.
Reopening rules.

## 14.4 AI tests

Classification:
Input schema validation.
Known test examples.
Unknown/ambiguous text.
Model unavailable.
Version metadata.
Evaluation metrics calculated from held-out data.
Priority:
All four output classes represented where dataset supports them.
Safety rule tests.
Low-confidence behavior.
Admin override and audit.
Duplicate detection:
Similar text and same location.
Similar text and different location.
Different text and same location.
Empty/short text.
No candidates.
Threshold boundary.
No automatic destructive action.
Analytics:
Correct aggregation.
Date boundaries.
Empty dataset.
Department/location grouping.
Insight provenance and date range.

## 14.5 Assignment and status tests

Correct staff assignment.
Wrong department assignment blocked.
Staff acceptance.
Work start.
Hold and resume.
Resolution evidence.
Verification.
Reassignment.
History preserved.

## 14.6 Notifications

Correct recipient.
In-app notification persisted.
Read/unread updates.
FCM success.
FCM failure does not undo complaint update.
Invalid device token handling.

## 14.7 Web/mobile integration

Same API contract.
Login on both clients.
Create complaint on mobile and view on web.
Admin assignment visible on mobile.
Staff update visible on web.
Notification behavior.
Image upload.
Expired token handling.
Network failure and retry behavior.

## 14.8 Testing levels

Unit tests: functions, services, validators and state transitions.
Integration tests: API + MongoDB + service integrations with mocks/test services.
UI tests: critical web and Flutter workflows.
End-to-end tests: full complaint lifecycle.
User acceptance testing: student, faculty, staff and administrator scenarios.
Do not use production data in tests. Provide seed/demo data clearly marked as fictional.

# 15. Development Roadmap and Acceptance Criteria

Build in phases. Do not start all clients and services simultaneously.

## Phase 1 — Requirement Analysis and System Design

Tasks:
Confirm all requirements.
Confirm roles and permissions.
Finalize complaint state machine.
Finalize database schema.
Finalize API contracts.
Finalize design system.
Set repository structure and development conventions.
Deliverables:
Master specification.
Architecture diagram.
ER-style relationship diagram.
API plan.
Wireframes/design tokens.
Development plan.
Completion:
Owner approves scope and unresolved policy decisions.

## Phase 2 — Database and Backend

Tasks:
Backend scaffold.
Environment configuration.
MongoDB connection.
Mongoose schemas.
Authentication and RBAC.
User and department management.
Complaint CRUD.
Status history.
Assignment lifecycle.
Validation, errors and tests.
Deliverable:
Working API with Postman collection and test coverage for critical paths.
Completion:
Authentication, authorization, complaint and assignment flows pass tests.

## Phase 3 — React Web Application

Tasks:
React scaffold.
Design system and layout.
Role-based routing.
Admin dashboard.
Complaint management/detail.
Departments and staff.
Facilities.
Faculty pages.
Staff pages.
Analytics and announcements.
API integration.
Deliverable:
Functional responsive web application.
Completion:
Main admin, faculty and staff workflows work against the shared backend.

## Phase 4 — Flutter Mobile Application

Tasks:
Flutter scaffold.
Material 3 theme.
Networking/authentication.
Secure session storage.
Student workflows.
Staff workflows.
Complaint forms and tracking.
Image selection/upload.
Notifications.
Role-based navigation.
Deliverable:
Functional Android application.
Completion:
Student and staff workflows work against the same backend used by React.

## Phase 5 — AI Integration

Tasks:
Prepare labeled dataset.
Establish baseline classification model.
Establish priority model if sufficient labeled data exists.
Evaluate models.
Build Sentence Transformer duplicate retrieval.
Build analytics aggregations.
Expose FastAPI endpoints.
Integrate Node AI client.
Store model metadata and admin overrides.
Deliverable:
Separate AI service integrated with Node.
Completion:
Tests pass; model performance is reported honestly; fallback behavior is defined.

## Phase 6 — Notifications and Advanced Features

Tasks:
In-app notification persistence.
FCM device registration and delivery.
Announcements.
Feedback.
Evidence workflow.
Report exports.
Deliverable:
Complete communication and feedback workflows.
Completion:
Notification and evidence workflows tested end-to-end.

## Phase 7 — Testing and Integration

Tasks:
Unit tests.
Integration tests.
Role-security tests.
Web/mobile end-to-end testing.
AI evaluation.
Error handling.
Performance checks.
Accessibility review.
Bug fixes.
Deliverable:
Test report and release candidate.
Completion:
Critical lifecycle works from complaint submission to feedback; no known critical authorization defects.

## Phase 8 — Deployment and Documentation

Tasks:
Production environment variables.
Deploy React, Node and AI services.
Configure MongoDB Atlas.
Configure Cloudinary and FCM.
HTTPS and CORS.
Logging and backups.
Final project report.
Architecture and API documentation.
Screenshots and demonstration script.
Deliverable:
Deployable project and MCA submission documentation.
Completion:
Reproducible deployment instructions and successful demonstration.

# 16. Definition of Done

A feature is not complete merely because a screen or endpoint exists.
A feature is done only when:
Requirement is documented.
Authorization is enforced.
Input validation is implemented.
Loading, success, empty and error states are handled.
Database persistence works where required.
API contract is documented.
Unit/integration tests are added as appropriate.
Both clients remain compatible with shared API changes.
Relevant tests/builds pass.
Known limitations are documented.
No secrets or private data are exposed.
Owner can review and explain the feature.

# 17. Project-Wide Codex Working Rules

Use these instructions for every Codex task:
First inspect relevant files; do not assume the repository is empty.
Read AGENTS.md and this master specification.
Prefer small, focused diffs.
Do not rewrite unrelated modules.
Do not add a dependency without explaining why it is needed.
Keep frontend API calls in service/client modules, not scattered through UI components.
Keep backend business logic out of route declarations and thin controllers.
Keep AI model inference separate from HTTP/business logic where practical.
Use environment variables and update .env.example when configuration changes.
Keep API schemas and client types/validation synchronized.
Add database indexes based on documented query needs.
Never trust client-supplied user ID or role.
Use server-side pagination and filtering.
Keep status transitions centralized and tested.
Preserve historical records.
Avoid hardcoded fake production data.
Use mock data only when clearly labeled and isolated.
Do not claim tests passed unless they were run.
If a command cannot be run, say so.
If a third-party credential is missing, implement a safe adapter/interface and document setup rather than inventing credentials.
If a design decision is ambiguous and materially affects architecture, ask the owner before proceeding.
When finishing, summarize changed files, behavior, tests, commands, limitations and next recommended task.

## 17.1 Required response format after each implementation task

Codex should report:
Objective completed
Files created/modified
Architecture/API/database impact
Tests and commands run
Results
Known limitations or required credentials
Next recommended task
Any decision requiring owner approval

# 18. Initial Codex Prompt

Paste this prompt into Codex after placing this file in the repository root:
You are taking over development of Clyra, an MCA final-year project. First read `CLYRA_MASTER_SPEC.md` and `AGENTS.md` completely. Treat them as the source of truth.
Do not start coding immediately.
First inspect the current repository, Git status, existing files and available toolchain. Identify what already exists and what is missing. Do not overwrite or delete existing work.
Then produce:
1. A repository state report.
2. A requirements-to-repository gap analysis.
3. A proposed implementation sequence aligned with the eight development phases in the master specification.
4. A list of unresolved product decisions that genuinely require owner input.
5. A recommended first implementation milestone with acceptance criteria.
Preserve the required architecture: React + Tailwind + Recharts web, Flutter + Dart + Material 3 mobile, Node.js + Express REST backend, MongoDB + Mongoose, and separate Python + FastAPI AI service. Both clients must use the same Node backend. MongoDB remains the central database. Do not substitute technologies or add unrelated modules.
Do not generate the entire application. Wait for approval of the plan before making implementation changes.

# 19. Decisions That Must Be Confirmed Before the Relevant Feature Is Built

Do not block all planning over these items, but do not silently invent final policies.
Campus email-domain restrictions and whether student registration is open, invitation-based or admin-approved.
Whether faculty and staff accounts are admin-created or self-registered with approval.
Whether faculty can reopen complaints under the same policy as students.
Whether staff can decline assignments and what reassignment workflow applies.
Whether all resolution submissions require admin verification.
Whether complainants can reopen a resolved complaint within a defined period.
Whether complaint evidence is public to campus users, visible only to owner/admin/assigned staff, or controlled by another policy.
Which exact category taxonomy and priority definitions the institution will use.
Which hosting providers and deployment budget are available.
Whether email notifications are required in addition to in-app and FCM.
Whether the project will be single-campus only for the first release.
Whether AI training data will be manually labeled, institution-provided or collected during pilot operation.
Use sensible development defaults for local prototypes, clearly mark them as provisional, and seek approval before production policy is finalized.

# 20. Final Product Principles

Clyra succeeds when it delivers a complete, secure and demonstrable campus complaint lifecycle—not when it has the largest number of screens or the most complicated infrastructure.
Priorities, in order:
Correct authentication and role permissions.
Reliable complaint creation and tracking.
Correct department/staff assignment.
Accurate status history and resolution evidence.
Consistent shared API for web and mobile.
Usable, professional interface.
Notifications and feedback.
AI assistance with honest evaluation.
Useful operational analytics.
Reliable deployment and documentation.
Final instruction: Build Clyra as a coherent, maintainable, AI-assisted campus operations product. Preserve the approved architecture, implement incrementally, test every important workflow, explain decisions, and keep the project understandable and defensible for an MCA final-year evaluation.
