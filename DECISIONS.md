# Design Decisions

## Frontend Package Manager: Bun

**Decision:** Use Bun instead of npm/pnpm/yarn.

**Justifications:**
- Significantly faster installs and script execution than npm/yarn
- Bun 1.0 (Sept 2023) is production-stable; well-supported by our full frontend stack (Vite, React, shadcn, React Query, Zustand)
- Consistent narrative with uv on the backend — both are "same category, better DX" choices
- Signals active ecosystem awareness without meaningful stability risk for this use case
- Will be noted explicitly in README with rationale

---

## Python Package Manager: uv

**Decision:** Use `uv` instead of `pip` + `venv`.

**Justifications:**
- 10-100x faster installs than pip
- Replaces `pip`, `venv`, and `pip-tools` in a single tool (`uv sync`, `uv add`, `uv run`)
- Generates `uv.lock` lockfile for reproducible installs across machines
- Uses `pyproject.toml` (modern Python packaging standard) instead of `requirements.txt`
- `uv run <cmd>` executes within the managed venv without manual activation

---

## Database: PostgreSQL + SQLAlchemy ORM

**Decision:** Use PostgreSQL as the primary database, accessed via SQLAlchemy ORM.

**Justifications:**
- Handles concurrent writes without file-level locking (critical for a multi-user trading app)
- Strong ACID compliance, especially isolation under concurrent load
- Better query planning and indexing for multi-dimensional filtering (price, date, location, type)
- Production-grade ecosystem (connection pooling, replicas, backups)
- SQLAlchemy ORM abstracts the DB layer — swapping connection string is the only change needed if the DB ever changes
- Deployment context (app will be hosted) makes setup friction a non-issue

**Seeding:** One-time `seed.py` script; populates ~1,000 realistic sample contracts (varied energy types, prices, quantities, grid zones, delivery dates, statuses) to validate frontend filtering performance at realistic scale.

## Contract Display: Table Only (No Detail View)

**Decision:** Display contracts in a table view only, no card view or detail/modal panel.

**Justifications:**
- Contract data is ~6-7 flat fields — all fit cleanly in a table row with no truncation needed
- Traders need to scan and compare across rows; tables are the natural affordance for this
- A detail view would just repeat the same data in a different layout — complexity with no added value
- Card view suits rich visual content (images, etc.) which energy contracts don't have

## Portfolio Persistence: Single Shared Portfolio (No Auth)

**Decision:** Portfolio is persisted to the database as a single shared portfolio — no user accounts, authentication, or session management.

**Justifications:**
- Multi-user support is not a stated requirement
- A single portfolio is sufficient for a solo reviewer testing the app
- Adding anonymous sessions or auth would add meaningful complexity with no requirement coverage
- Deliberate scoping decision — will be documented clearly in README to avoid ambiguity

## Frontend State Management: Zustand + React Query

**Decision:** Use React Query for server state and Zustand for client UI state.

**Justifications:**
- React Query handles fetch lifecycle (caching, loading/error states, automatic refetch on filter change) cleanly without boilerplate
- Zustand manages client-only state (active filters, UI toggles) with surgical re-renders — only components subscribed to changed state re-render
- Redux is overkill for this scope; MobX introduces unnecessary complexity; Context causes broad re-renders on frequent filter updates
- Both libraries are lightweight, widely recognized, and easy to reason about in a code review

## Date Handling: Date-Only, No Timezone Normalization

**Decision:** Delivery dates are stored and transmitted as date-only values (`YYYY-MM-DD`) with no time component and no timezone.

**Justifications:**
- Contracts in this app are modeled at day granularity (delivery start/end date) — no sub-daily precision needed
- Date-only sidesteps timezone complexity entirely; timezone normalization is only critical for hourly/sub-hourly contracts (e.g. day-ahead power at peak hours), which is out of scope
- In real US energy markets, timezone convention varies by grid (ERCOT=CT, PJM/NYISO=ET, CAISO=PT); most platforms normalize to ET or UTC — acknowledged in README as a known simplification
- SQLAlchemy `Date` column + Python `date` type + Pydantic `date` field enforce date-only at every layer
- Frontend displays raw `YYYY-MM-DD` string or splits manually — avoids `new Date()` UTC-midnight timezone shift bug

---

## Numeric Precision: `Decimal` / `NUMERIC` for Price and Quantity

**Decision:** Use `Decimal` (Python) / `NUMERIC` (PostgreSQL) for `price_per_mwh` and `quantity_mwh` instead of `float`.

**Justifications:**
- Floats use binary floating-point representation which cannot precisely represent many decimal values (e.g. `0.1 + 0.2 = 0.28999...`) — unacceptable for financial data
- `Numeric(10, 2)` for price (2 decimal places, e.g. `$45.67`), `Numeric(12, 3)` for quantity (3 decimal places, e.g. `124.750 MWh`)
- PostgreSQL `NUMERIC` stores exact values with no rounding error
- Pydantic v2 serializes `Decimal` as a string in JSON to preserve precision — frontend parses with `parseFloat()` for calculations and formats with `toLocaleString()` for display

---

## Database Indexes on Contract Columns

**Decision:** Add `index=True` on all filterable `Contract` columns: `energy_type`, `status`, `location`, `price_per_mwh`, `quantity_mwh`, `delivery_start`, `delivery_end`.

**Justifications:**
- B-tree indexes reduce filter queries from O(n) sequential scan to O(log n) — critical at scale
- Our workload is overwhelmingly read-heavy (traders browsing/filtering); write cost (slightly slower INSERTs, small disk overhead) is negligible given infrequent writes
- Low-cardinality columns (energy type, status, location) benefit from indexes on equality filters
- Numeric and date columns benefit on range queries (`WHERE price BETWEEN x AND y`)
- Zero practical impact at 1,000 records (Postgres uses sequential scans at small scale), but correct production design and signals DB awareness to reviewer

---

## Enum Synchronization: Runtime API Endpoint (`GET /meta/enums`)

**Decision:** Backend exposes `GET /meta/enums` returning valid values for `EnergyType`, `ContractStatus`, and `GridZone`. Frontend fetches this once on load (React Query `staleTime: Infinity`) and uses it to populate filter options. No hardcoded enum values in frontend code.

**Justifications:**
- Backend Python enums are the single source of truth — no duplication, no manual sync
- Runtime correctness is guaranteed: if the backend changes enum values, the frontend always reflects them without a code change or rebuild
- Compile-time type safety tradeoff is acceptable: if the data contract changes enough to break `string[]`, TypeScript safety would be meaningless anyway
- Server-side cache: enum values computed once at module load (no DB call, no per-request overhead)
- Frontend cache: `staleTime: Infinity` — fetched once per session, never refetched unless page reloads

---

## Frontend Styling: shadcn/ui + Tailwind

**Decision:** Use shadcn/ui component library with Tailwind CSS.

**Justifications:**
- shadcn/ui provides production-quality components (table, filters, badges, buttons) that live directly in the codebase — not a black-box dependency
- Tailwind handles layout and custom spacing cleanly alongside shadcn
- Current, widely-recognized stack that signals strong frontend awareness to a reviewer
- Faster to build polished UI than plain CSS; less opinionated visually than MUI

## Project Structure: Monorepo with Separate Top-Level Dirs

**Decision:** Single repository with `/backend` and `/frontend` as top-level directories.

**Justifications:**
- Clean separation of concerns while keeping everything in one repo
- Conventional, intuitive structure for any reviewer to navigate
- Scales cleanly if the project grows

## Filtering: Backend-Capable, Frontend-Implemented

**Decision:** `GET /contracts` supports filter query params (Pydantic-validated, tested), but the frontend fetches all contracts and filters client-side via Zustand.

**Justifications:**
- Satisfies the stated filtering requirement at the API level
- Client-side filtering is appropriate for the realistic scale of an energy contract marketplace (hundreds to low-thousands of contracts — a niche B2B platform, not a consumer marketplace)
- Better UX: instant local filtering, fewer round trips to the server
- Lower frontend complexity: React Query fetches once, Zustand manages filter state
- Backend capability exists if scale ever demanded server-side filtering
- Design decision and rationale will be documented explicitly in README

## UI Layout: Split Panel (Desktop) / Bottom Tabs (Mobile)

**Decision:** Desktop uses a split panel layout (contracts table left, portfolio right) with a collapsible portfolio panel. Mobile uses two bottom tabs ("Contracts" and "Portfolio").

**Justifications:**
- Split panel lets traders see portfolio build in real-time as they add contracts — natural for a trading interface
- Portfolio panel collapses to a slim bar (showing contract count + total cost) to maximize contract table screen real estate — mirrors shopping cart UX pattern
- No drag-to-resize (adds complexity without enough value); collapse toggle is sufficient
- Mobile tab layout is the standard native pattern for this type of two-context UI
- Tailwind responsive prefixes (`md:`) handle the layout switch without duplicating components
