# Energy Contract Marketplace — Implementation Plan

## Tech Stack Summary
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), asyncpg, PostgreSQL, Pydantic v2, pytest + httpx
- **Frontend:** React 18, TypeScript, Vite, Zustand, TanStack React Query v5, shadcn/ui, Tailwind CSS
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
cd backend
python -m venv .venv && source .venv/bin/activate
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg pydantic python-dotenv
pip install pytest pytest-asyncio httpx aiosqlite  # testing deps
pip freeze > requirements.txt
```

### 0.3 Frontend Init
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npx shadcn@latest init          # follow prompts: default style, slate base
npm install @tanstack/react-query zustand
npm install -D tailwindcss postcss autoprefixer
```

**Verification:** `uvicorn app.main:app --reload` returns 200, `npm run dev` loads Vite default page.

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
    energy_type: Mapped[str] = mapped_column(String(50))   # solar, wind, gas, hydro, nuclear
    quantity_mwh: Mapped[float] = mapped_column(Float)
    price_per_mwh: Mapped[float] = mapped_column(Float)
    delivery_start: Mapped[date] = mapped_column(Date)
    delivery_end: Mapped[date] = mapped_column(Date)
    location: Mapped[str] = mapped_column(String(100))     # grid zone
    status: Mapped[str] = mapped_column(String(20))        # available, pending, sold

class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"), unique=True)
```

### 1.3 `seed.py`
- Generate ~1,000 contracts with:
  - `energy_type`: random from [solar, wind, natural_gas, hydro, nuclear]
  - `quantity_mwh`: random float 10–500 MWh
  - `price_per_mwh`: realistic ranges per type (solar: $20–60, wind: $25–65, gas: $40–120, hydro: $15–45, nuclear: $30–80)
  - `delivery_start/end`: random date ranges within next 24 months
  - `location`: random from 15–20 realistic US grid zones (e.g., ERCOT, PJM, MISO, CAISO, NYISO, SPP, SERC)
  - `status`: weighted random — 70% available, 20% pending, 10% sold
- Use `session.add_all(contracts)` + `await session.commit()`

**Verification:** `python seed.py` exits cleanly; `SELECT COUNT(*) FROM contracts;` returns ~1000.

---

## Phase 2: Backend — API Endpoints

### 2.1 `app/schemas.py`
```python
from pydantic import BaseModel, ConfigDict
from datetime import date

class ContractBase(BaseModel):
    energy_type: str
    quantity_mwh: float
    price_per_mwh: float
    delivery_start: date
    delivery_end: date
    location: str
    status: str

class ContractCreate(ContractBase): pass

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
GET  /contracts          — list all with optional filters
POST /contracts          — create contract
PUT  /contracts/{id}     — update contract
DELETE /contracts/{id}   — delete contract
```

Optional filter query params on GET: `energy_type`, `min_price`, `max_price`, `min_quantity`, `max_quantity`, `location`, `status`, `delivery_start_after`, `delivery_end_before`

All params are `Optional[...]` with `None` default — filters applied conditionally in SQLAlchemy query.

### 2.3 `app/routers/portfolio.py`
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
- `test_list_contracts_empty` — GET /contracts returns []
- `test_create_contract` — POST /contracts returns 201 with correct fields
- `test_filter_by_energy_type` — GET /contracts?energy_type=solar returns only solar
- `test_filter_by_price_range` — GET /contracts?min_price=30&max_price=60
- `test_filter_by_location` — GET /contracts?location=ERCOT
- `test_filter_combined` — multiple filters applied simultaneously
- `test_update_contract` — PUT /contracts/{id} updates fields
- `test_delete_contract` — DELETE /contracts/{id} returns 204

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
  id: number
  energy_type: string
  quantity_mwh: number
  price_per_mwh: number
  delivery_start: string   // ISO date string
  delivery_end: string
  location: string
  status: 'available' | 'pending' | 'sold'
}

export interface PortfolioItem {
  id: number
  contract_id: number
  contract: Contract
}

export interface PortfolioMetrics {
  total_contracts: number
  total_capacity_mwh: number
  total_cost: number
  weighted_avg_price: number
  breakdown_by_type: Record<string, number>
}

export interface Portfolio {
  items: PortfolioItem[]
  metrics: PortfolioMetrics
}

export interface ContractFilters {
  energy_types: string[]
  min_price: number | null
  max_price: number | null
  min_quantity: number | null
  max_quantity: number | null
  locations: string[]
  delivery_start_after: string | null
  delivery_end_before: string | null
  statuses: string[]
}
```

### 4.2 `src/api/contracts.ts` + `src/api/portfolio.ts`
- Plain async fetch functions (not hooks — React Query wraps these)
- Base URL from `import.meta.env.VITE_API_URL`
- `fetchContracts(): Promise<Contract[]>` — no filter params (frontend filters client-side)
- `createContract`, `updateContract`, `deleteContract`
- `fetchPortfolio(): Promise<Portfolio>`
- `addToPortfolio(contractId)`, `removeFromPortfolio(contractId)`

### 4.3 `src/store/useFilterStore.ts` — Zustand
```typescript
import { create } from 'zustand'
import { ContractFilters } from '../types'

interface FilterStore {
  filters: ContractFilters
  setFilter: <K extends keyof ContractFilters>(key: K, value: ContractFilters[K]) => void
  resetFilters: () => void
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
}

export const useFilterStore = create<FilterStore>((set) => ({
  filters: defaultFilters,
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  resetFilters: () => set({ filters: defaultFilters }),
}))
```

### 4.4 `src/hooks/useContracts.ts` — React Query v5
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchContracts, deleteContract } from '../api/contracts'

export const useContracts = () =>
  useQuery({
    queryKey: ['contracts'],
    queryFn: fetchContracts,
    staleTime: 1000 * 60 * 5,  // 5 min cache
  })
```

### 4.5 `src/hooks/usePortfolio.ts`
```typescript
export const usePortfolio = () =>
  useQuery({ queryKey: ['portfolio'], queryFn: fetchPortfolio })

export const useAddToPortfolio = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: addToPortfolio,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  })
}

export const useRemoveFromPortfolio = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: removeFromPortfolio,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portfolio'] }),
  })
}
```

**Verification:** `console.log` in hooks returns contract array from API.

---

## Phase 5: Frontend — Client-Side Filtering Logic

### 5.1 `src/hooks/useFilteredContracts.ts`
```typescript
// Derives filtered contracts from Zustand filter state + React Query data
// No server calls — pure in-memory filter
export const useFilteredContracts = (): { contracts: Contract[], count: number } => {
  const { data: allContracts = [] } = useContracts()
  const filters = useFilterStore((s) => s.filters)

  const contracts = useMemo(() => {
    return allContracts.filter((c) => {
      if (filters.energy_types.length && !filters.energy_types.includes(c.energy_type)) return false
      if (filters.min_price !== null && c.price_per_mwh < filters.min_price) return false
      if (filters.max_price !== null && c.price_per_mwh > filters.max_price) return false
      if (filters.min_quantity !== null && c.quantity_mwh < filters.min_quantity) return false
      if (filters.max_quantity !== null && c.quantity_mwh > filters.max_quantity) return false
      if (filters.locations.length && !filters.locations.includes(c.location)) return false
      if (filters.statuses.length && !filters.statuses.includes(c.status)) return false
      if (filters.delivery_start_after && c.delivery_start < filters.delivery_start_after) return false
      if (filters.delivery_end_before && c.delivery_end > filters.delivery_end_before) return false
      return true
    })
  }, [allContracts, filters])

  return { contracts, count: contracts.length }
}
```

**Verification:** Applying a filter reduces the displayed contract count in real-time.

---

## Phase 6: Frontend — Components

### 6.1 `src/components/ContractTable.tsx`
- Uses shadcn `Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`
- Columns: Energy Type, Quantity (MWh), Price/MWh, Delivery Start, Delivery End, Location, Status, Action
- Status rendered as a colored `Badge` (available=green, pending=yellow, sold=red)
- Action column: "Add" button (disabled if already in portfolio or status !== 'available')
- Result count displayed above table: `Showing {count} of {total} contracts`
- Uses `useFilteredContracts()` for data, `useAddToPortfolio()` for action

### 6.2 `src/components/FilterPanel.tsx`
- Energy type: `Checkbox` group (solar, wind, natural_gas, hydro, nuclear)
- Price range: two number inputs (min/max)
- Quantity range: two number inputs (min/max)
- Location: multi-select `Checkbox` group (all unique locations from contract data)
- Delivery dates: two date inputs (start after, end before)
- Status: `Checkbox` group
- "Reset Filters" button → calls `resetFilters()` from Zustand
- All inputs call `setFilter()` on change → instant re-filter via `useFilteredContracts`

### 6.3 `src/components/PortfolioPanel.tsx`
- Lists portfolio items (contract ID, type, quantity, price, total value)
- "Remove" button per item → `useRemoveFromPortfolio()`
- Renders `PortfolioSummary` at bottom
- Collapsible on desktop: toggle button collapses to slim bar showing `{n} contracts | $X total`
- Collapsed state stored in local `useState` (not Zustand — purely UI, not shared)

### 6.4 `src/components/PortfolioSummary.tsx`
- Displays: Total Contracts, Total Capacity (MWh), Total Cost ($), Weighted Avg Price ($/MWh)
- Breakdown by energy type: simple list or mini table
- All values derived from `usePortfolio().data.metrics`

### 6.5 `src/components/Layout.tsx`
- Desktop (≥ md): flex row — `FilterPanel` + `ContractTable` left side, `PortfolioPanel` right
- Mobile (< md): tab bar at bottom — "Contracts" tab (shows filter + table), "Portfolio" tab
- Tab state in local `useState`
- Tailwind responsive: `hidden md:flex` / `flex md:hidden` pattern

### 6.6 `src/App.tsx`
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Layout />
    </QueryClientProvider>
  )
}
```

**Verification:** Full UI renders, filters work, add/remove portfolio works, metrics update.

---

## Phase 7: Polish & Deliverables

### 7.1 UX Polish
- Loading states: skeleton rows in table while contracts fetch
- Error states: toast or inline error message if API unreachable
- Empty states: "No contracts match your filters" with reset button
- Disable "Add" for contracts already in portfolio (cross-reference portfolio item contract_ids)
- Mobile tab indicator showing portfolio count badge

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
2. Tech stack
3. Prerequisites (Python 3.11+, Node 18+, PostgreSQL)
4. Setup — backend (venv, install, env vars, DB creation, seed, run)
5. Setup — frontend (install, env vars, run)
6. API documentation (endpoint list with params)
7. Design decisions (migrate from DECISIONS.md)
8. Known limitations (single shared portfolio, no auth)
9. Post-MVP roadmap (SSE, contract comparison, charting)

### 7.4 Final Verification Checklist
- [ ] `pytest tests/ -v` — all green
- [ ] Seed script runs cleanly, DB has ~1,000 records
- [ ] All CRUD endpoints work via `/docs` UI
- [ ] Frontend filter panel reduces table count in real-time
- [ ] Portfolio add/remove updates metrics immediately
- [ ] Collapsible portfolio panel works on desktop
- [ ] Mobile tab layout renders correctly at < 768px
- [ ] No console errors in browser
- [ ] README setup instructions work end-to-end from a clean clone

---

## Post-MVP TODO (Do Not Implement Until MVP Complete)

### P1: Real-Time Contract Updates via SSE
- **Backend:** `pip install sse-starlette asyncpg`
- PostgreSQL LISTEN/NOTIFY: trigger on `contracts` table INSERT/UPDATE/DELETE
- `GET /contracts/stream` — SSE endpoint using `sse_starlette.sse.EventSourceResponse`
- asyncpg listens on connection, forwards events to SSE clients
- **Frontend:** `EventSource('/contracts/stream')` in a `useEffect`; on message → `queryClient.invalidateQueries(['contracts'])`

### P2: Contract Comparison
- Multi-select checkboxes on table rows (max 3)
- "Compare" button activates side-by-side modal (shadcn `Dialog`)
- Compare all fields in a column layout

### P3: Portfolio Charting
- Pie or donut chart for energy type breakdown
- Use `recharts` (works well with shadcn/Tailwind projects)
