import { energyColor } from "@/lib/colors";
import { formatCurrency, formatMwh } from "@/lib/format";
import type { PortfolioMetrics } from "@/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-card p-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function PortfolioSummary({ metrics }: { metrics: PortfolioMetrics }) {
  const breakdown = Object.entries(metrics.breakdown_by_type)
    .map(([type, mwh]) => ({ type, mwh: parseFloat(mwh) }))
    .sort((a, b) => b.mwh - a.mwh);

  const maxMwh = breakdown[0]?.mwh ?? 0;
  const totalMwh = breakdown.reduce((sum, b) => sum + b.mwh, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Contracts" value={metrics.total_contracts.toString()} />
        <Stat
          label="Capacity"
          value={`${formatMwh(metrics.total_capacity_mwh)} MWh`}
        />
        <Stat label="Total Cost" value={formatCurrency(metrics.total_cost)} />
        <Stat
          label="Avg $/MWh"
          value={formatCurrency(metrics.weighted_avg_price)}
        />
      </div>

      {breakdown.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Capacity by energy type
          </div>
          <div className="flex flex-col gap-1.5">
            {breakdown.map(({ type, mwh }) => {
              const barPct = maxMwh > 0 ? (mwh / maxMwh) * 100 : 0;
              const sharePct = totalMwh > 0 ? (mwh / totalMwh) * 100 : 0;
              return (
                <div key={type} className="flex items-center gap-2 text-sm">
                  <span className="w-24 truncate">{type}</span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: energyColor(type),
                      }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
                    {sharePct.toFixed(0)}%
                  </span>
                  <span className="w-24 text-right tabular-nums">
                    {formatMwh(mwh)} MWh
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
