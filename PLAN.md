# Energy Contract Marketplace — Implementation Plan

## Tech Stack Summary

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), asyncpg, PostgreSQL, Pydantic v2, pytest + httpx, uv (package manager)
- **Frontend:** React 18, TypeScript, Vite, Zustand, TanStack React Query v5, shadcn/ui, Tailwind CSS, Bun (package manager)
- **Structure:** Monorepo — `/backend` + `/frontend`

---

## Phase 0: Project Scaffolding

### 0.1 Repo Structure

```
/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI app, CORS, router inclusion
│   │   ├── database.py       # engine, async_session, Base, get_db
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   ├── schemas.py        # Pydantic v2 schemas
│   │   ├── routers/
│   │   │   ├── contracts.py  # CRUD endpoints for contracts
│   │   │   └── portfolio.py  # Portfolio endpoints
│   │   └── crud/
│   │       ├── contracts.py  # DB query logic for contracts
│   │       └── portfolio.py  # DB query logic for portfolio
│   ├── tests/
│   │   ├── conftest.py       # pytest fixtures, async client, test DB
│   │   ├── test_contracts.py
│   │   └── test_portfolio.py
│   ├── seed.py               # Seed ~1,000 realistic contracts
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   │   ├── contracts.ts  # fetch functions for contracts
│   │   │   └── portfolio.ts  # fetch functions for portfolio
│   │   ├── components/
│   │   │   ├── ContractTable.tsx
│   │   │   ├── FilterPanel.tsx
│   │   │   ├── PortfolioPanel.tsx
│   │   │   ├── PortfolioSummary.tsx
│   │   │   └── Layout.tsx    # split panel + mobile tab layout
│   │   ├── store/
│   │   │   └── useFilterStore.ts   # Zustand store for filter state
│   │   ├── hooks/
│   │   │   ├── useContracts.ts     # React Query hook for contracts
│   │   │   └── usePortfolio.ts     # React Query hooks for portfolio
│   │   └── types/
│   │       └── index.ts      # TypeScript interfaces
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── .env.example
├── DECISIONS.md
├── PLAN.md
└── README.md
```

### 0.2 Backend Init

```bash
uv init backend
cd backend
uv add fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg pydantic python-dotenv
uv add --dev pytest pytest-asyncio httpx aiosqlite
```

Key files uv generates:

- `pyproject.toml` — project metadata + dependencies
- `uv.lock` — reproducible lockfile (commit this)
- `.venv/` — auto-created virtual environment

Running the app: `uv run uvicorn app.main:app --reload`
Running tests: `uv run pytest tests/ -v`

### 0.3 Frontend Init

```bash
bun create vite frontend --template react-ts
cd frontend
bun install
bunx shadcn@latest init         # follow prompts: default style, slate base
bun add @tanstack/react-query zustand
bun add -d tailwindcss postcss autoprefixer @playwright/test
bunx playwright install --with-deps
```

Running the app: `bun run dev`
Running tests: `bun test`

**Verification:** `uv run uvicorn app.main:app --reload` returns 200, `bun run dev` loads Vite default page.

---

## Phase 1: Backend — Database Layer

### 1.1 `app/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator

DATABASE_URL = "postgresql+asyncpg://user:pass@localhost/betm"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
```

### 1.2 `app/models.py` — Contract + PortfolioItem

```python
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Float, Date, Enum as SAEnum
from datetime import date
from app.database import Base

class Contract(Base):
    __tablename__ = "contracts"
    id: Mapped[int] = mapped_column(primary_key=True)
    energy_type: Mapped[str] = mapped_column(String(50), index=True)          # low cardinality, frequent filter
    quantity_mwh: Mapped[Decimal] = mapped_column(Numeric(12, 3), index=True) # exact decimal, range queries
    price_per_mwh: Mapped[Decimal] = mapped_column(Numeric(10, 2), index=True) # exact decimal, range queries
    delivery_start: Mapped[date] = mapped_column(Date, index=True)     # date only (no time/timezone) — appropriate for day-granularity contracts
    delivery_end: Mapped[date] = mapped_column(Date, index=True)       # date only (no time/timezone) — appropriate for day-granularity contracts
    location: Mapped[str] = mapped_column(String(100), index=True)     # low cardinality, frequent filter
    status: Mapped[str] = mapped_column(String(20), index=True)        # low cardinality, frequent filter

class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"), unique=True)
```

### 1.3 `seed.py`

- Generate ~1,000 contracts with:
  - `energy_type`: random from `EnergyType` enum values (Solar, Wind, Natural Gas, Hydro, Nuclear)
  - `quantity_mwh`: random float 10–500 MWh
  - `price_per_mwh`: realistic ranges per type (solar: $20–60, wind: $25–65, gas: $40–120, hydro: $15–45, nuclear: $30–80)
  - `delivery_start/end`: random date ranges within next 24 months
  - `location`: random from `GridZone` enum values (e.g., Texas, California, Northeast, Midwest)
  - `status`: weighted random — 70% available, 20% pending, 10% sold
- Use `session.add_all(contracts)` + `await session.commit()`

**Verification:** `python seed.py` exits cleanly; `SELECT COUNT(*) FROM contracts;` returns ~1000.

---

## Phase 2: Backend — API Endpoints

### 2.1 `app/schemas.py`

Define enums for constrained string fields. FastAPI automatically returns `422 Unprocessable Entity` with a descriptive error message if an invalid value is passed — this applies to both request bodies and query params (e.g. `GET /contracts?energy_type=sollllar` → 422). The enums are also imported by `seed.py` to guarantee seed data is consistent.

```python
from pydantic import BaseModel, ConfigDict, Field
from datetime import date
from enum import Enum

class EnergyType(str, Enum):
    solar = "Solar"
    wind = "Wind"
    natural_gas = "Natural Gas"
    hydro = "Hydro"
    nuclear = "Nuclear"

class ContractStatus(str, Enum):
    available = "Available"
    pending = "Pending"
    sold = "Sold"

class GridZone(str, Enum):
    texas = "Texas"
    california = "California"
    northeast = "Northeast"
    midwest = "Midwest"
    southeast = "Southeast"
    southwest = "Southwest"
    northwest = "Northwest"
    mid_atlantic = "Mid-Atlantic"
    great_plains = "Great Plains"
    rocky_mountains = "Rocky Mountains"

class ContractBase(BaseModel):
    energy_type: EnergyType
    quantity_mwh: Decimal = Field(gt=0)     # exact decimal precision; Pydantic serializes as string in JSON
    price_per_mwh: Decimal = Field(gt=0)    # exact decimal precision; Pydantic serializes as string in JSON
    delivery_start: date
    delivery_end: date
    location: GridZone
    status: ContractStatus

class ContractUpdate(BaseModel):
    status: ContractStatus | None = None    # partial update — only expose what's needed

class ContractResponse(ContractBase):
    model_config = ConfigDict(from_attributes=True)
    id: int

class PortfolioItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    contract_id: int
    contract: ContractResponse

class PortfolioMetrics(BaseModel):
    total_contracts: int
    total_capacity_mwh: float
    total_cost: float
    weighted_avg_price: float
    breakdown_by_type: dict[str, float]  # energy_type -> total_mwh

class PortfolioResponse(BaseModel):
    items: list[PortfolioItemResponse]
    metrics: PortfolioMetrics
```

### 2.2 `app/routers/contracts.py`

```
GET /contracts      — list all with optional filters
PUT /contracts/{id} — update contract (e.g. status changes)
```

Optional filter query params on GET: `energy_type`, `min_price`, `max_price`, `min_quantity`, `max_quantity`, `location`, `status`, `delivery_start_after`, `delivery_end_before`

All params are `Optional[...]` with `None` default — filters applied conditionally in SQLAlchemy query.

**Validation on filter params:**

- `energy_type` → `Optional[EnergyType]`, `location` → `Optional[GridZone]`, `status` → `Optional[ContractStatus]` — invalid enum values → 422
- `min_price`, `max_price`, `min_quantity`, `max_quantity` → `Optional[float] = Query(None, ge=0)` — zero is a valid lower bound for a range filter (e.g. "show me contracts with price ≥ 0"); negative values → 422
- Note the intentional distinction: contract fields use `gt=0` (a contract with zero price/quantity is meaningless), filter params use `ge=0` (zero is a valid range boundary)

### 2.3 `app/routers/meta.py`

```
GET /meta/enums  →  { energy_types: [...], statuses: [...], grid_zones: [...] }
```

- Returns all valid enum values for `EnergyType`, `ContractStatus`, and `GridZone`
- Python enums are the single source of truth — no duplication in frontend code
- Server-side: values are computed from the enum classes at module load time (effectively free — no DB call, no recomputation per request)
- Frontend: fetched once on load via React Query with a long `staleTime` (e.g. `Infinity`) — cached for the lifetime of the session
- Frontend uses the response to populate filter panel checkboxes and drive filter state — `string[]` types are acceptable given runtime correctness is guaranteed by the backend

```python
# routers/meta.py
from app.schemas import EnergyType, ContractStatus, GridZone

_enum_cache = {
    "energy_types": [e.value for e in EnergyType],
    "statuses": [e.value for e in ContractStatus],
    "grid_zones": [e.value for e in GridZone],
}

@router.get("/enums")
def get_enums():
    return _enum_cache
```

### 2.4 `app/routers/portfolio.py`

```
GET    /portfolio                      — list items + computed metrics
POST   /portfolio/{contract_id}        — add contract to portfolio
DELETE /portfolio/{contract_id}        — remove contract from portfolio
```

Metrics computed in Python from fetched portfolio items (not a DB aggregate query — simpler and fast enough for this scale).

### 2.4 `app/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import contracts, portfolio

app = FastAPI(title="Energy Contract Marketplace")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev; add prod URL via env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contracts.router, prefix="/contracts", tags=["contracts"])
app.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
app.include_router(meta.router, prefix="/meta", tags=["meta"])
```

**Verification:** All endpoints return correct status codes via `curl` or FastAPI `/docs` UI.

---

## Phase 3: Backend — Tests

### 3.1 `tests/conftest.py`

- `test_db` fixture: SQLite in-memory via `aiosqlite` (swap connection string, same ORM)
- Override `get_db` dependency with test session
- `async_client` fixture: `httpx.AsyncClient(app=app, base_url="http://test")`

```python
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.main import app
from app.database import Base, get_db

@pytest.fixture
async def async_client(test_db):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
```

Note: `ASGITransport` is the correct httpx pattern for FastAPI (not `app=` directly in newer httpx versions).

### 3.2 `tests/test_contracts.py`

- `test_list_contracts` — GET /contracts returns seeded contracts
- `test_filter_by_energy_type` — GET /contracts?energy_type=Solar returns only Solar contracts
- `test_filter_by_price_range` — GET /contracts?min_price=30&max_price=60
- `test_filter_by_price_range_zero_lower_bound` — GET /contracts?min_price=0 returns all (0 is valid lower bound for filter params, uses `ge=0` not `gt=0`)
- `test_filter_by_quantity_range` — GET /contracts?min_quantity=50&max_quantity=200
- `test_filter_by_location` — GET /contracts?location=Texas returns only Texas contracts
- `test_filter_invalid_location` — GET /contracts?location=FAKEZONE returns 422
- `test_filter_combined` — multiple filters applied simultaneously
- `test_filter_invalid_energy_type` — GET /contracts?energy_type=sollllar returns 422
- `test_filter_invalid_status` — GET /contracts?status=unknown returns 422
- `test_filter_invalid_negative_price` — GET /contracts?min_price=-10 returns 422 (negative filter values rejected)
- `test_filter_invalid_negative_quantity` — GET /contracts?min_quantity=-1 returns 422
- `test_update_contract` — PUT /contracts/{id} updates fields

### 3.3 `tests/test_portfolio.py`

- `test_add_to_portfolio` — POST /portfolio/{contract_id} returns 201
- `test_add_duplicate_rejected` — second POST same contract_id returns 409
- `test_remove_from_portfolio` — DELETE /portfolio/{contract_id} returns 204
- `test_portfolio_metrics` — GET /portfolio returns correct totals and breakdown

**Verification:** `pytest tests/ -v` all green.

---

## Phase 4: Frontend — Types, API Layer, State

### 4.1 `src/types/index.ts`

```typescript
export interface Contract {
  id: number;
  energy_type: string; // string — enum values sourced at runtime from GET /meta/enums
  quantity_mwh: string; // Decimal serialized as string by Pydantic — parse with parseFloat() for display
  price_per_mwh: string; // Decimal serialized as string by Pydantic — format with toLocaleString() for currency display
  delivery_start: string; // YYYY-MM-DD date string (no time, no timezone)
  delivery_end: string; // YYYY-MM-DD date string (no time, no timezone)
  location: string; // string — enum values sourced at runtime from GET /meta/enums
  status: string; // string — enum values sourced at runtime from GET /meta/enums
}

export interface EnumValues {
  energy_types: string[];
  statuses: string[];
  grid_zones: string[];
}

export interface PortfolioItem {
  id: number;
  contract_id: number;
  contract: Contract;
}

export interface PortfolioMetrics {
  total_contracts: number;
  total_capacity_mwh: number;
  total_cost: number;
  weighted_avg_price: number;
  breakdown_by_type: Record<string, number>;
}

export interface Portfolio {
  items: PortfolioItem[];
  metrics: PortfolioMetrics;
}

export interface ContractFilters {
  energy_types: string[];
  min_price: number | null;
  max_price: number | null;
  min_quantity: number | null;
  max_quantity: number | null;
  locations: string[];
  delivery_start_after: string | null;
  delivery_end_before: string | null;
  statuses: string[];
}
```

### 4.2 `src/api/contracts.ts` + `src/api/portfolio.ts`

- Plain async fetch functions (not hooks — React Query wraps these)
- Base URL from `import.meta.env.VITE_API_URL`
- `fetchContracts(): Promise<Contract[]>` — no filter params (frontend filters client-side)
- `updateContract(id, data)` — for status changes
- `fetchPortfolio(): Promise<Portfolio>`
- `addToPortfolio(contractId)`, `removeFromPortfolio(contractId)`
- `fetchEnums(): Promise<EnumValues>` — fetches valid enum values from `GET /meta/enums`

### 4.3 `src/store/useFilterStore.ts` — Zustand

```typescript
import { create } from "zustand";
import { ContractFilters } from "../types";

interface FilterStore {
  filters: ContractFilters;
  setFilter: <K extends keyof ContractFilters>(
    key: K,
    value: ContractFilters[K],
  ) => void;
  resetFilters: () => void;
}

const defaultFilters: ContractFilters = {
  energy_types: [],
  min_price: null,
  max_price: null,
  min_quantity: null,
  max_quantity: null,
  locations: [],
  delivery_start_after: null,
  delivery_end_before: null,
  statuses: [],
};

export const useFilterStore = create<FilterStore>((set) => ({
  filters: defaultFilters,
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),
}));
```

### 4.4 `src/hooks/useContracts.ts` — React Query v5

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchContracts, deleteContract } from "../api/contracts";

export const useContracts = () =>
  useQuery({
    queryKey: ["contracts"],
    queryFn: fetchContracts,
    staleTime: 1000 * 60 * 5, // 5 min cache
  });
```

### 4.5 `src/hooks/usePortfolio.ts`

```typescript
export const usePortfolio = () =>
  useQuery({ queryKey: ["portfolio"], queryFn: fetchPortfolio });

export const useAddToPortfolio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addToPortfolio,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
};

export const useRemoveFromPortfolio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeFromPortfolio,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolio"] }),
  });
};
```

### 4.6 `src/hooks/useEnums.ts`

```typescript
export const useEnums = () =>
  useQuery({
    queryKey: ["enums"],
    queryFn: fetchEnums,
    staleTime: Infinity, // enum values don't change without a backend redeploy
  });
```

- `FilterPanel` calls `useEnums()` to populate checkbox options for energy type, status, and grid zone
- No hardcoded option arrays anywhere in the frontend — backend is the single source of truth

**Verification:** `console.log` in hooks returns contract array and enum values from API.

---

## Phase 5: Frontend — Client-Side Filtering Logic

### 5.1 `src/hooks/useFilteredContracts.ts`

```typescript
// Derives filtered contracts from Zustand filter state + React Query data
// No server calls — pure in-memory filter
export const useFilteredContracts = (): {
  contracts: Contract[];
  count: number;
} => {
  const { data: allContracts = [] } = useContracts();
  const filters = useFilterStore((s) => s.filters);

  const contracts = useMemo(() => {
    return allContracts.filter((c) => {
      if (
        filters.energy_types.length &&
        !filters.energy_types.includes(c.energy_type)
      )
        return false;
      if (filters.min_price !== null && c.price_per_mwh < filters.min_price)
        return false;
      if (filters.max_price !== null && c.price_per_mwh > filters.max_price)
        return false;
      if (
        filters.min_quantity !== null &&
        c.quantity_mwh < filters.min_quantity
      )
        return false;
      if (
        filters.max_quantity !== null &&
        c.quantity_mwh > filters.max_quantity
      )
        return false;
      if (filters.locations.length && !filters.locations.includes(c.location))
        return false;
      if (filters.statuses.length && !filters.statuses.includes(c.status))
        return false;
      if (
        filters.delivery_start_after &&
        c.delivery_start < filters.delivery_start_after
      )
        return false;
      if (
        filters.delivery_end_before &&
        c.delivery_end > filters.delivery_end_before
      )
        return false;
      return true;
    });
  }, [allContracts, filters]);

  return { contracts, count: contracts.length };
};
```

**NaN guard:** before applying numeric filter values, skip the comparison if the value is `NaN` — protects against malformed input bypassing browser-native constraints (e.g. via dev tools):

```typescript
const safeMin = (val: number | null) =>
  val !== null && !isNaN(val) ? val : null;
// applied to min_price, max_price, min_quantity, max_quantity before filter comparisons
```

**Date comparison:** string comparison (`c.delivery_start < filters.delivery_start_after`) works correctly for `YYYY-MM-DD` format since it is lexicographically sortable — no `Date` parsing needed in filter logic.

**Date display gotcha:** do NOT use `new Date("2026-03-01")` for display — browsers interpret bare date strings as UTC midnight, which shifts to the previous day in negative-offset timezones (e.g. ET). Instead display the raw `YYYY-MM-DD` string directly, or split on `-` and reformat manually:

```typescript
// safe: no timezone shift
const formatDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
};
```

**Verification:** Applying a filter reduces the displayed contract count in real-time.

---

## Phase 6: Frontend — Components

### 6.1 `src/components/ContractTable.tsx`

- Uses shadcn `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`
- Columns: Energy Type, Quantity (MWh), Price/MWh, Delivery Start, Delivery End, Location, Status, Action
- Status rendered as a colored `Badge` (available=green, pending=yellow, sold=red)
- Action column: "Add to Portfolio" button (disabled if already in portfolio or status !== 'available')
- Toolbar above table: "Filters" button (opens Sheet) with active filter count badge, and result count `Showing {count} of {total} contracts`
- Uses `useFilteredContracts()` for data, `useAddToPortfolio()` for action

### 6.2 `src/components/FilterPanel.tsx`

**Container:** shadcn `Sheet` with `side="left"`, opened via a "Filters" button above the contract table. Button shows an active filter count badge when filters are applied (e.g. "Filters (3)") so the user always knows their filter state at a glance without opening the panel. Closes via X button or clicking the overlay.

**Internal layout — prioritize clarity:**

- Each filter group is a labeled section with consistent padding and a `Separator` between groups
- Section labels are uppercase, small, muted — visually distinct from filter values
- Generous vertical spacing between groups so the eye can scan without effort
- Sheet has a sticky header (title + close button) and sticky footer (Reset + result count) — filter fields scroll in between if needed

**Filter fields (in order):**

- **Energy Type** — `Checkbox` group, options sourced from `useEnums()`, displayed as readable labels (e.g. "Natural Gas" not "natural_gas")
- **Status** — `Checkbox` group, options sourced from `useEnums()`, colored dot next to each label matching table Badge colors
- **Price ($/MWh)** — two `Input` fields side by side (Min / Max) with `$` prefix adornment
- **Quantity (MWh)** — two `Input` fields side by side (Min / Max) with `MWh` suffix label
- **Delivery Dates** — two date `Input` fields (Start after / End before) with clear labels
- **Location** — `Checkbox` group, options sourced from `useEnums()`, scrollable if list is long

**Active filter state visibility:**

- Each active filter section shows a subtle highlight or checkmark count so user knows what's applied
- "Reset Filters" button in sticky footer, disabled when no filters are active
- Result count in sticky footer: "Showing 142 of 1,000 contracts" — updates in real-time

**Range input constraints** — applied consistently across all min/max and date range pairs:

- **Price:** `max_price` input sets `min` to current `min_price` value; `min_price` input sets `max` to current `max_price` value — prevents max < min
- **Quantity:** same pattern as price — `max_quantity` min-bounded by `min_quantity` and vice versa
- **Delivery dates:** end date input sets `min` to start date + 1 day; start date input sets `max` to end date - 1 day — prevents end ≤ start
- All fields are independently optional — constraints only apply when both sides of a pair are set

**All inputs:** call `setFilter()` on change → instant client-side re-filter via `useFilteredContracts`, no submit button needed

### 6.3 `src/components/PortfolioPanel.tsx`

- Lists portfolio items (contract ID, type, quantity, price, total value)
- "Remove" button per item → `useRemoveFromPortfolio()`
- Renders `PortfolioSummary` at bottom
- Collapsible on desktop: toggle button collapses to slim bar showing `{n} contracts | $X total`
- Collapsed state stored in local `useState` (not Zustand — purely UI, not shared)

### 6.4 `src/components/PortfolioSummary.tsx`

- Displays: Total Contracts, Total Capacity (MWh), Total Cost ($), Weighted Avg Price ($/MWh)
- All values derived from `usePortfolio().data.metrics`

**Visual breakdown — proportional bar chart via CSS/Tailwind (no charting library):**

- One row per energy type present in portfolio, sorted by MWh descending
- Each row: colored label, proportional filled bar (`width: ${pct}%` inline style), percentage, and MWh value
- Bar colors are consistent with energy type Badge colors used in the contract table
- Bars sized relative to the largest energy type (100% width = largest slice)
- Zero dependencies — pure div + Tailwind, renders instantly

```tsx
{
  Object.entries(metrics.breakdown_by_type).map(([type, mwh]) => (
    <div key={type} className="flex items-center gap-2">
      <span className="w-24 text-sm truncate">{type}</span>
      <div className="flex-1 bg-muted rounded h-2">
        <div
          className="h-2 rounded"
          style={{
            width: `${(mwh / maxMwh) * 100}%`,
            backgroundColor: ENERGY_COLORS[type],
          }}
        />
      </div>
      <span className="text-sm text-muted-foreground w-16 text-right">
        {pct}%
      </span>
      <span className="text-sm w-24 text-right">
        {mwh.toLocaleString()} MWh
      </span>
    </div>
  ));
}
```

### 6.5 `src/components/Layout.tsx`

- Desktop (≥ md): flex row — `FilterPanel` + `ContractTable` left side, `PortfolioPanel` right
- Mobile (< md): tab bar at bottom — "Contracts" tab (shows filter + table), "Portfolio" tab
- Tab state in local `useState`
- Tailwind responsive: `hidden md:flex` / `flex md:hidden` pattern

### 6.6 `src/App.tsx`

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout />
    </QueryClientProvider>
  );
}
```

**Verification:** Full UI renders, filters work, add/remove portfolio works, metrics update.

---

## Phase 7: Polish & Deliverables

### 7.1 UX Polish

- Loading states: skeleton rows in table while contracts fetch
- Empty states: "No contracts match your filters" with reset button
- Disable "Add" for contracts already in portfolio (cross-reference portfolio item contract_ids)
- Mobile tab indicator showing portfolio count badge

**Error handling — API errors → toast notifications (shadcn `Sonner` or `Toast`):**

- `useContracts` / `usePortfolio`: on `isError`, render a toast: "Failed to load data. Please try again."
- `useAddToPortfolio` / `useRemoveFromPortfolio`: on mutation error, render a toast with the error message
- `422 Unprocessable Entity`: surface the Pydantic error detail from the response body in the toast — e.g. "Invalid value for energy_type. Must be one of: solar, wind, natural_gas, hydro, nuclear."
- API fetch utility should parse non-2xx responses and throw with the response body's `detail` field so React Query's `error` object contains the human-readable message
- General fallback: "An unexpected error occurred." for 500s or network failures

### 7.2 `.env.example` files

```
# backend/.env.example
DATABASE_URL=postgresql+asyncpg://user:password@localhost/betm

# frontend/.env.example
VITE_API_URL=http://localhost:8000
```

### 7.3 README.md

Sections:

1. Project overview
2. Live demo URL (Vercel) + API docs URL (Railway)
3. Tech stack
4. Prerequisites (Python 3.11+, Bun, PostgreSQL, uv)
5. Setup — backend (uv sync, env vars, DB creation, seed, run)
6. Setup — frontend (bun install, env vars, run)
7. Running tests — pytest + Playwright
8. API documentation (endpoint list with params)
9. Design decisions (migrate from DECISIONS.md)
10. Known limitations (single shared portfolio, no auth, date-only timezone assumption)
11. Post-MVP roadmap (contract comparison, SSE, enhanced charting, auth, migrations)

### 7.4 E2E Tests — Playwright

**Setup:**

```bash
cd frontend
bunx playwright install --with-deps
bun add -d @playwright/test
```

Requires both backend and frontend running locally. Tests live in `frontend/e2e/`.

**Happy path test cases (`e2e/marketplace.spec.ts`):**

- **Contracts load:** page loads, table renders with >0 rows, result count is displayed
- **Filter by energy type:** check "Solar" → table updates, all visible rows show "Solar", count decreases
- **Filter reset:** active filter badge shows count, clicking Reset clears filters, full contract list restored
- **Filter range — price:** enter min/max price → only contracts within range shown
- **Filter range — date constraint:** selecting start date disables prior dates in end date picker
- **Add to portfolio:** click "Add to Portfolio" on an available contract → contract appears in portfolio panel, metrics update (total contracts, total cost)
- **Duplicate add prevented:** "Add to Portfolio" button disabled for contract already in portfolio
- **Remove from portfolio:** click "Remove" → contract removed from portfolio panel, metrics update
- **Portfolio collapse/expand:** click collapse toggle → panel collapses to slim bar showing count + cost; click again → expands
- **Empty filter state:** apply filters with no matches → "No contracts match your filters" message + Reset button shown
- **Mobile layout:** resize viewport to 375px wide → tab bar appears at bottom, "Contracts" and "Portfolio" tabs navigate correctly

**Verification:** `bunx playwright test` — all tests pass; `bunx playwright test --ui` for interactive browser view during development.

### 7.5 Final Verification Checklist

- `uv run pytest tests/ -v` — all green
- `bunx playwright test` — all e2e tests pass
- Seed script runs cleanly, DB has ~1,000 records
- All endpoints work via FastAPI `/docs` UI
- Frontend filter panel reduces table count in real-time
- Portfolio add/remove updates metrics immediately
- Collapsible portfolio panel works on desktop
- Mobile tab layout renders correctly at < 768px
- No console errors in browser
- README setup instructions work end-to-end from a clean clone

---

## Phase 8: Deployment

**Frontend → Vercel | Backend + PostgreSQL → Railway**

### 8.1 Backend — Railway

1. Sign up at railway.app (GitHub login recommended)
2. New Project → "Deploy from GitHub repo" → select this repo
3. Set root directory to `/backend`
4. Add a PostgreSQL plugin — Railway injects `DATABASE_URL` automatically
5. Set additional env vars in Railway dashboard:
   ```
   ALLOWED_ORIGINS=https://your-app.vercel.app
   ```
6. Add a `Procfile` or `railway.toml` in `/backend` to specify the start command:
   ```
   web: uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
7. After first deploy, run seed script via Railway CLI or one-off command:
   ```bash
   railway run uv run python seed.py
   ```
8. Note the Railway-provided backend URL (e.g. `https://betm-backend.up.railway.app`)

### 8.2 Frontend — Vercel

1. Go to vercel.com → New Project → import this repo
2. Set root directory to `/frontend`
3. Framework preset: Vite (auto-detected)
4. Set env var in Vercel dashboard:
   ```
   VITE_API_URL=https://betm-backend.up.railway.app
   ```
5. Deploy — Vercel builds `bun run build` and serves `dist/`
6. Note the Vercel-provided frontend URL (e.g. `https://betm.vercel.app`)

### 8.3 CORS Update

Update backend CORS config to allow the Vercel production URL alongside localhost:

```python
allow_origins=[
    "http://localhost:5173",          # local dev
    "https://betm.vercel.app",        # production — set via env var
]
```

Best practice: drive `ALLOWED_ORIGINS` from an env var so no code change is needed per environment:

```python
import os
allow_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
```

### 8.4 Deployment Notes for README

- Live demo URL: `https://betm.vercel.app` (available during review window)
- Backend API: `https://betm-backend.up.railway.app/docs` (FastAPI docs publicly accessible)
- Deployed on Railway free trial — may have cold start delay (~10-15s) if instance has been idle
- PostgreSQL hosted on Railway, pre-seeded with ~1,000 contracts

### 8.5 Verification Checklist

- [ ] Backend health check: `GET https://betm-backend.up.railway.app/contracts` returns data
- [ ] Frontend loads at Vercel URL, table populated from Railway backend
- [ ] Filters work on production build
- [ ] Portfolio add/remove persists on production DB
- [ ] No CORS errors in browser console

---

## Post-MVP TODO (Do Not Implement Until MVP Complete)

### P1: Contract Comparison (explicitly listed in assignment doc)

- Multi-select checkboxes on table rows (max 3)
- "Compare" button activates side-by-side modal (shadcn `Dialog`)
- Compare all fields in a column layout

### P2: Real-Time Contract Updates via SSE

- **Backend:** `uv add sse-starlette asyncpg`
- PostgreSQL LISTEN/NOTIFY: trigger on `contracts` table INSERT/UPDATE/DELETE
- `GET /contracts/stream` — SSE endpoint using `sse_starlette.sse.EventSourceResponse`
- asyncpg listens on connection, forwards events to SSE clients
- **Frontend:** `EventSource('/contracts/stream')` in a `useEffect`; on message → `queryClient.invalidateQueries(['contracts'])`

### P3: Enhanced Portfolio Charting

- Replace CSS bar chart with an interactive pie/donut chart if richer visualization is desired
- Use `recharts` (works well with shadcn/Tailwind projects) — adds ~100KB bundle, only worth it if interactivity is needed

### P4: Database Migrations (Alembic)

- Replace `Base.metadata.create_all` (used for dev/seed) with proper migration management via Alembic
- `uv add alembic`, init with `alembic init migrations`
- Each schema change gets a versioned migration file — supports safe rollforward/rollback
- Required for any production deployment where schema evolves without dropping data

### P5: Error Handling & Logging

- **Structured logging:** replace `print`/default uvicorn logs with Python `logging` module or `structlog` — JSON-formatted logs with request ID, endpoint, status code, duration
- **Global exception handler:** FastAPI `@app.exception_handler` for unhandled exceptions → consistent JSON error response shape (`{ detail, status_code, request_id }`)
- **Frontend:** expand toast error handling to include request IDs for traceability

### P6: Authentication

- Add user accounts and JWT-based auth (e.g. `python-jose`, `passlib`)
- Each user gets their own portfolio (replace single shared portfolio with per-user portfolio)
- Protected endpoints via FastAPI `Depends(get_current_user)`
- Frontend: login/register flow, token storage, authenticated API requests
