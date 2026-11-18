# Policies pending owner/campus approval — do not assume production defaults

Derived from blueprint Section 19 (12 items).

1. Student domain restriction and open vs invitation/admin-approved registration. **Safe development default**: public registration is disabled; admin can create users.
2. Faculty/staff self-service vs admin creation. **Default**: admin-created only.
3. Faculty reopening. **Default**: no reopening until policy approved.
4. Staff declining assignments and reassignment. **Default**: decline disabled; admin reassigns with reason.
5. Resolution verification. **Default**: always requires administrator.
6. Reopen window. **Default**: disabled for complainants, admin can reopen with reason.
7. Complaint/evidence privacy. **Default**: private to owner, assigned staff and administrator; Cloudinary media must be protected in production.
8. Exact category taxonomy and priority definitions. **Default**: the nine categories/four priorities from the blueprint; admin overrides with audit.
9. Hosting provider/budget. **Default**: none; local development only.
10. Email notifications. **Default**: not configured; in-app records only.
11. Single campus. **Default**: yes (specified initial scope).
12. Training data origin and consent. **Default**: no models trained and no synthetic accuracy metrics.

**Important**: Placeholder adapters are not live integrations. Record explicit owner approval before promoting these provisional policies to production.
