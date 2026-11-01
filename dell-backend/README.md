# Dell backend: schema prototype, not a deployed service

The SQL file is a **non-executed staging database design** based on read-only inspection of JK Works Supabase tables (app_records, app_deletions, public_requests). It is not a Supabase Auth replacement.

- Source `public.app_records` primary key: (user_id, store, record_id); JSONB data.
- Source `public.app_deletions` primary key: (user_id, store, record_id).
- Source `public.public_requests` includes PII and request photo paths; never expose directly.
- Auth, push tables, calendar secrets, files and RLS/authorization still require explicit implementation.
- Staging account UUIDs are placeholders for future verified identity mapping; do not copy real auth sessions or JWT secrets.
- `file_objects` is a *new proposal*, not a Supabase schema copy.
- SQL is NOT run automatically by GitHub/Coolify. Existing nginx staging Dockerfile remains unchanged.
- Never connect original frontend to staging with production credentials. Never move data until full backups and restore tests are confirmed.

Next: implement an authenticated service API with per-user authorization, input validation, CSRF/session protection, and secure upload/download; test with fictional data before access to real business records.
