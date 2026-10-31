# JK Works Dell staging checklist

Status: preparation only. Live deployment stays on main + Supabase.

## Backups
- User confirmed an in-app backup saved to iCloud on 2026-10-31.
- This is an additional user-controlled recovery copy, not a verified full Supabase backup.
- Do not upload the backup to GitHub or share the backup password.
- Before any database or Auth migration, export and restore-test Supabase Postgres/Auth and all Storage object bytes separately.

## Isolation rules
- Branch: dell-migration-staging-20261031
- Production branch: main (do not modify).
- Use a separate test hostname and a distinct database/storage namespace on Dell.
- Test must not send customer messages, push reminders, invoices or calendar links.
- Prevent automatic synchronization from any copied client to production Supabase.
- No cutover until explicit approval after user acceptance testing.

## Discovery
- Inventory service dependencies: Supabase auth, tables/RLS, buckets, Edge Functions, push, calendar, local IndexedDB.
- Design a standalone Dell backend that preserves current business functionality and role boundaries.
- Preserve recovery and rollback paths.
