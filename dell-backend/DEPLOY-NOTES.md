# JK Works staging-only backend prototype

This is a **standalone, fail-closed prototype**, not a production backend and not yet connected to JK Works or PostgreSQL. All business routes return 503; no users can sign in; no data is read or written.

- Local checks: `node --test dell-backend/server.test.mjs` (Node 22+).
- Optional standalone Coolify application: build from separate resource, Dockerfile `/dell-backend/Dockerfile`, port 8090.
- **Do not replace** current `test.jkworks.nl` frontend resource, alter main, attach any production Supabase credentials, or share a public domain with this API.
- Expose only behind internal Docker networking until auth/authorization and database are implemented.
- This Dockerfile is deliberately not referenced by `dell-staging/Dockerfile`; publishing the site does not activate API.
- Future implementation: unique staging DB + role, hashed credentials compatible with selected auth design, audited per-owner CRUD, DB transactions, Storage uploads, and full tests before connecting any business data.
