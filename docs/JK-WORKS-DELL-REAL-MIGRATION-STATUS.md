# JK Works migration: measured state and next production-safe milestones

## Verified by user on 2026-11-01
- Coolify frontend at https://test.jkworks.nl connects to private Node backend, and backend to PostgreSQL.
- Staging account login works; a synthetic customer record survives a browser refresh.
- Existing public jkworks.nl app and Supabase data have not been migrated.
- Frontend currently hosts a **test harness**, not the existing full business app.

## Architecture to retain
- Existing production app on GitHub Pages/Supabase stays unchanged until a restored, fully working cutover is tested.
- Frontend and backend on private Coolify Docker network, backend PostgreSQL on jk_staging.
- No public backend ports; staging test site remains HTTPS + Coolify Basic Auth.
- Do not use changing deployment-specific hostnames in BACKEND_UPSTREAM for long term. Assign a stable Docker network alias on the backend resource (e.g. jkworks-backend-staging) and point the frontend at that alias once the user can verify Coolify's Edit Networking UI; do not switch an active upstream without a connectivity test.

## Work already implemented (test-only)
- Session cookie authentication and per-owner records CRUD.
- Consistent read snapshot endpoint GET /api/v1/sync/snapshot (requires session), returning {records,deletions}; snapshot requires backend redeployment.
- Synthetic test customers in test-only UI.

## Work needed before an actual migration
1. Audit cloud.js, db.js, app.js and the website + all service workers for Supabase assumptions, backup/restore and IndexedDB object shapes, including Blob/photo data. Preserve original UI exactly.
2. Implement an isolated Dell cloud-adapter replacing JKCloud behavior: authenticated login, owner-scoped sync queue flush with deletes, conflict resolution and safe initial sync. Protect private settings and blobs, don't queue server-derived changes.
3. Implement binary storage and permissions, public requests, calendar feeds, notifications and complete feature parity. Add integration tests and backup/restore tests.
4. Export and verify full copies of Supabase Auth, tables, Storage and private application files. Prove count/hash parity and restore in staging before any import. Never run a partial production migration.
5. Verify multi-device login, offline behavior, add/edit/delete, invoices, PDFs, receipt files, push, backups and restore.
6. Only after approval switch production DNS and shut down the old Supabase dependency.

## Security gates
No real customer data should be copied into the test database before a verified backup and isolated import path exist. No raw credentials committed to GitHub. Keep ENABLE_STAGING_API limited to private staging, and do not infer production readiness from the API's status response.
