# Code Review Notes (April 7, 2026)

I reviewed the current codebase with a focus on architecture, security, data integrity, and maintainability.

## What’s strong

- The product scope is clear and practical: item lifecycle, scanning, intake, and reporting are all represented end-to-end.
- The backend includes useful helper abstractions (`readJSON`, `writeJSON`, `addLog`, stage validation), which keep repeated logic reasonably consistent.
- AI features are gated behind environment checks so the app remains usable when `OPENAI_API_KEY` is missing.
- The item log model is a strong foundation for auditing and future analytics.

## Key risks and recommended priorities

### 1) Authorization and trust boundary are weak (highest priority)
- Several sensitive operations trust `requestedBy` from request bodies and then read admin status from local users.
- There is no session/token verification on API routes, so identity is effectively client-asserted.
- Practical next step: add signed auth (JWT/session cookie) and enforce role checks server-side from verified identity, not request payload fields.

### 2) Credentials and secrets handling need hardening
- Default seeded users all use `1234` PINs and PINs are stored in plaintext.
- Practical next step: hash PINs (`bcrypt`/`argon2`), remove default universal PINs, and force PIN reset on first login.

### 3) Monolithic server file limits maintainability
- `server.js` currently handles all domains (users, items, events, reports, AI, uploads, intake) in one file.
- Practical next step: split into route modules (`routes/items.js`, `routes/events.js`, etc.) plus service layer (`services/ai.js`, `services/storage.js`).

### 4) Data access model can cause blocking and write races
- All persistence is synchronous file I/O via JSON flat files.
- Under concurrent use this can block the event loop and risk last-write-wins behavior.
- Practical next step: move to async data access and introduce a transactional store (SQLite/Postgres).

### 5) Some code paths appear inconsistent or legacy
- `public/app.js` includes a `<script>` tag in a `.js` file and calls `POST /items`, but the current server does not expose `POST /items` (it uses `POST /addItems` for intake batches).
- Practical next step: confirm whether `public/app.js` is still active; if not, remove/archive it to reduce confusion.

## Medium-priority quality improvements

- Add request validation (e.g., `zod` or `joi`) for all write endpoints.
- Add a small test suite around critical flows: login, intake creation, stage changes, event assignment, and closeout reporting.
- Normalize date fields (`soldAt` vs any derived/reporting date) and centralize date helpers to avoid reporting mismatches.
- Add lightweight API versioning before further feature expansion.

## Suggested 2-phase plan

### Phase 1 (stability/security, 1–2 sprints)
1. Introduce real auth/session middleware.
2. Hash PINs and migrate existing user records.
3. Add schema validation and centralized error responses.
4. Add smoke tests for core item lifecycle.

### Phase 2 (scalability/maintainability, 2–4 sprints)
1. Split server into modules.
2. Replace flat JSON storage with SQLite/Postgres.
3. Add migration scripts and backups.
4. Add observability (structured logs + basic metrics).

