import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useContracts } from "./hooks/useContracts";
import { useEnums } from "./hooks/useEnums";
import { usePortfolio } from "./hooks/usePortfolio";

const queryClient = new QueryClient();

function Diagnostics() {
  const contracts = useContracts();
  const enums = useEnums();
  const portfolio = usePortfolio();

  return (
    <div style={{ fontFamily: "monospace", padding: 24 }}>
      <h1>Phase 4 wiring check</h1>
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
      </ul>
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
