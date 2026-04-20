# Energy Contract Marketplace

A full-stack take-home project: browse ~1,000 energy contracts with rich
client-side filtering, add/remove from a shared portfolio, and view live
aggregate metrics.

## Live Demo

- Frontend: _https://betm.vercel.app_ (added once deployed)
- Backend API + docs: _https://betm-backend.up.railway.app/docs_

Deployment runs on free tiers — the backend may cold-start for ~10–15s
after idle.

## Tech Stack

**Backend**

- Python 3.11+, FastAPI, Pydantic v2
- SQLAlchemy 2.0 (async) + asyncpg / aiosqlite
- PostgreSQL (prod), SQLite (local dev)
- pytest + httpx for integration tests
- `uv` for package + venv management

**Frontend**

- React 19 + TypeScript, Vite 8
- TanStack React Query v5 (server state), Zustand (filter state)
- shadcn/ui on Base UI React primitives
- Tailwind CSS v4
- `bun` for package + script management
- Playwright for E2E tests

## Repository Layout

```
backend/     FastAPI app, ORM models, tests, seed script
frontend/    React SPA, components, hooks, E2E tests
DECISIONS.md Log of design/architecture decisions and rationale
PLAN.md      Phased implementation plan
```

## Prerequisites

- Python 3.11+
- `uv` — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- `bun` — `curl -fsSL https://bun.sh/install | bash`
- (Prod only) PostgreSQL 14+

## Local Setup

### 1. Backend

```bash
cd backend
cp .env.example .env                 # defaults to local SQLite
uv sync                              # installs deps into .venv
uv run python seed.py                # creates dev.db, inserts ~1,000 contracts
uv run uvicorn app.main:app --reload # serves on :8000
```

OpenAPI docs at `http://localhost:8000/docs`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env                 # VITE_API_URL=http://localhost:8000
bun install
bun run dev                          # serves on :5173
```

Open `http://localhost:5173`.

## Running Tests

```bash
# Backend — 28 integration tests (HTTP → Pydantic → CRUD → SQLAlchemy → SQLite)
cd backend
uv run pytest tests/ -v

# Frontend — Playwright E2E (both servers must be running)
cd frontend
bunx playwright test
bunx playwright test --ui          # interactive browser mode
```

## API Overview

| Method | Path                      | Notes                                             |
| ------ | ------------------------- | ------------------------------------------------- |
| GET    | `/contracts`              | List; supports filter query params (see below)    |
| GET    | `/contracts/{id}`         | Single contract (404 if missing)                  |
| PUT    | `/contracts/{id}`         | Update status (422 on invalid enum, 404 on miss)  |
| GET    | `/portfolio`              | Items + computed metrics                          |
| POST   | `/portfolio/{contract_id}`| Add to portfolio (404 / 409 duplicate)            |
| DELETE | `/portfolio/{contract_id}`| Remove from portfolio                             |
| GET    | `/meta/enums`             | All valid `EnergyType`/`ContractStatus`/`GridZone`|

**`GET /contracts` filter params:** `energy_type`, `min_price`, `max_price`,
`min_quantity`, `max_quantity`, `location`, `status`,
`delivery_start_after`, `delivery_end_before`. Invalid enum values return
422 with the Pydantic error detail.

## Design Decisions

See **[DECISIONS.md](./DECISIONS.md)** for the full log. Key calls:

- **PostgreSQL over SQLite** for prod — ACID guarantees and concurrent write
  support matter for a multi-user trading app
- **Enum source of truth on backend** — frontend fetches valid values at
  runtime from `/meta/enums` rather than duplicating hardcoded lists
- **Decimal (not float) for quantity/price** — financial precision; Pydantic
  serializes to JSON strings, frontend parses for arithmetic/display
- **Backend supports filters but frontend filters client-side** — architectural
  correctness + snappy UX at this dataset size (~1K rows)
- **Shared portfolio, no auth** — deliberate scope cut. Per-user portfolios
  are in the post-MVP roadmap
- **Date-only fields (no timezone)** — contracts settle on dates, not
  instants. Frontend formats `YYYY-MM-DD` manually to avoid UTC-midnight
  timezone drift from `new Date(dateString)`

## Known Limitations

- Single shared portfolio across all users (no auth)
- `Base.metadata.create_all` instead of Alembic migrations (fine for a
  fresh-start demo; Alembic is in the post-MVP roadmap)
- No pagination — table renders all ~1,000 rows. Scales fine at this size
  but pagination would be required beyond ~10K rows

## Post-MVP Roadmap

Documented in [PLAN.md](./PLAN.md):

- **P1** — Contract Comparison (multi-select + side-by-side modal)
- **P2** — Real-time contract updates via SSE + PostgreSQL `LISTEN/NOTIFY`
- **P3** — Enhanced portfolio charting (recharts donut)
- **P4** — Alembic migrations
- **P5** — Structured logging + global exception handler
- **P6** — User auth (JWT) + per-user portfolios
