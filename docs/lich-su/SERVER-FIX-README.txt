CNCT HCM Portal - SERVER STABILITY FIX
Build: STABLE-RESTORE-20260808-SERVER-FIX

Fixes:
- SQLite WAL + 30s busy timeout + NullPool.
- Retry SQLite locked commits.
- Database health check.
- SQLAlchemy errors return controlled 503 instead of unhandled errors.
- Google Sheet cached data is returned immediately; page requests do not wait for Google when cache exists.
- Admin person update validates payload and rolls back safely on failure.
- Frontend files/design are kept from the supplied source; no frontend redesign in this build.

Verified locally:
GET /api/health -> 200
POST /api/auth/login -> 200
GET /api/admin/people -> 200
PUT /api/admin/people/{id} -> 200
