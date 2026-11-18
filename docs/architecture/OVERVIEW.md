# Architecture

```mermaid
flowchart TB
  React[React / Tailwind Web] --> Node[Node + Express REST API]
  Flutter[Flutter Android / Material 3] --> Node
  Node --> Auth[JWT + RBAC + Ownership]
  Auth --> Mongo[(MongoDB clyra_db)]
  Node --> AI[Private FastAPI service]
  Node --> Cloudinary[Cloudinary media adapter]
  Node --> FCM[Firebase Cloud Messaging adapter]
  FCM --> Flutter
```

Node is the sole business orchestrator. MongoDB holds users, complaints, status histories, assignments, notifications, feedback, locations, announcements and audits. Clients never query MongoDB or FastAPI directly. AI outages degrade to human review, without rejecting complaints.

```mermaid
erDiagram
  USER ||--o{ COMPLAINT : submits
  USER ||--o{ ASSIGNMENT : receives
  COMPLAINT ||--o{ ASSIGNMENT : has
  COMPLAINT ||--o{ STATUS_HISTORY : records
  COMPLAINT ||--o| FEEDBACK : receives
  LOCATION ||--o{ COMPLAINT : identifies
  DEPARTMENT ||--o{ ASSIGNMENT : routes
  USER ||--o{ NOTIFICATION : receives
```
