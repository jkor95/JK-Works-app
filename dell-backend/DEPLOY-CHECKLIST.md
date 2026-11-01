# Dell JK Works isolated database: deployment checklist

Prepared, **not executed**. The existing Coolify staging site at test.jkworks.nl remains unchanged.

## Safety properties
- Compose creates NEW named volume `jkworks-staging_jkworks_staging_pg`.
- The staging PostgreSQL 18 service has no published ports and is on an isolated Docker network.
- Schema SQL runs only on first initialization of the NEW empty database.
- Backend currently exposes only health/status. All business API endpoints still deny requests.
- No Supabase secrets, users, customer records or production Storage attached.
- Do not add either container to the production Coolify proxy.
- Staging database content is **not yet covered** by the current Restic database-export script.

## Before deployment
1. Check Docker volume names and Coolify project isolation; never connect existing `jkworks` test DB.
2. Create a strong, unique password in a private host-only environment file (permissions 0600). Do not commit .env.
3. Verify off-server backups and a working restore procedure for this NEW database.
4. In Coolify create a **new separate resource** for this stack (do not replace the existing test site).
5. Validate Docker Compose config and database initialization before any external exposure.
6. Test with dummy user IDs and synthetic records only.

## Database lifecycle
- Only when authorized, install compose; wait for green pg_isready.
- Do not use Docker Compose `down -v`, `volume rm` or manual deletes.
- The healthcheck confirms process availability, not data correctness.
- Add authenticated backend APIs and per-user authorization before any migration.
- Confirm backup success and restore with dummy records before importing real data.

## Deployment state
GitHub files ready; neither Coolify resource nor database has been deployed.
