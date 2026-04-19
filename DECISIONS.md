# Design Decisions

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
