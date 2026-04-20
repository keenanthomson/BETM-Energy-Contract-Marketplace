import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useContracts } from "./hooks/useContracts";
import { useEnums } from "./hooks/useEnums";
import { useFilteredContracts } from "./hooks/useFilteredContracts";
import { usePortfolio } from "./hooks/usePortfolio";
import { useFilterStore } from "./store/useFilterStore";

const queryClient = new QueryClient();

function Diagnostics() {
  const contracts = useContracts();
  const enums = useEnums();
  const portfolio = usePortfolio();
  const filtered = useFilteredContracts();
  const filters = useFilterStore((s) => s.filters);
  const toggleInArray = useFilterStore((s) => s.toggleInArray);
  const setFilter = useFilterStore((s) => s.setFilter);
  const reset = useFilterStore((s) => s.resetFilters);

  return (
    <div style={{ fontFamily: "monospace", padding: 24 }}>
      <h1>Phase 4 + 5 wiring check</h1>
      <ul>
        <li>
          contracts:{" "}
          {contracts.isLoading
            ? "loading…"
            : contracts.isError
              ? `error: ${contracts.error.message}`
              : `${contracts.data?.length} records`}
        </li>
        <li>
          enums:{" "}
          {enums.isLoading
            ? "loading…"
            : enums.isError
              ? `error: ${enums.error.message}`
              : `${enums.data?.energy_types.length} energy_types, ${enums.data?.statuses.length} statuses, ${enums.data?.grid_zones.length} grid_zones`}
        </li>
        <li>
          portfolio:{" "}
          {portfolio.isLoading
            ? "loading…"
            : portfolio.isError
              ? `error: ${portfolio.error.message}`
              : `${portfolio.data?.items.length} items, total_cost=$${portfolio.data?.metrics.total_cost}`}
        </li>
        <li>
          filtered: {filtered.count} / {filtered.total}
        </li>
      </ul>

      <div style={{ marginTop: 16 }}>
        <strong>Test filters:</strong>
        <div>
          {enums.data?.energy_types.map((t) => (
            <label key={t} style={{ marginRight: 8 }}>
              <input
                type="checkbox"
                checked={filters.energy_types.includes(t)}
                onChange={() => toggleInArray("energy_types", t)}
              />{" "}
              {t}
            </label>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          max price:{" "}
          <input
            type="number"
            value={filters.max_price ?? ""}
            onChange={(e) =>
              setFilter(
                "max_price",
                e.target.value === "" ? null : parseFloat(e.target.value),
              )
            }
          />
          <button onClick={reset} style={{ marginLeft: 8 }}>
            reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Diagnostics />
    </QueryClientProvider>
  );
}
