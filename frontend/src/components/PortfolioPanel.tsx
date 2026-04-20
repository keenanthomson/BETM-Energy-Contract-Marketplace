import { useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { StatusBadge } from "@/components/StatusBadge";
import { usePortfolio, useRemoveFromPortfolio } from "@/hooks/usePortfolio";
import { formatCurrency, formatMwh } from "@/lib/format";
import { ApiError } from "@/api/client";

export function PortfolioPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const { data, isLoading, isError } = usePortfolio();
  const remove = useRemoveFromPortfolio();

  const handleRemove = (contractId: number) => {
    remove.mutate(contractId, {
      onError: (err) => {
        const msg =
          err instanceof ApiError ? err.message : "Failed to remove contract";
        toast.error(msg);
      },
    });
  };

  if (collapsed) {
    return (
      <aside className="hidden md:flex w-12 shrink-0 flex-col items-center border-l bg-background py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(false)}
          aria-label="Expand portfolio"
        >
          <ChevronLeftIcon />
        </Button>
        <div className="mt-4 rotate-180 [writing-mode:vertical-rl] text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Portfolio
          {data ? ` · ${data.metrics.total_contracts}` : ""}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-full md:w-96 shrink-0 flex-col border-l bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-heading text-base font-medium">Portfolio</h2>
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse portfolio"
        >
          <ChevronRightIcon />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading portfolio…</div>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            Failed to load portfolio.
          </div>
        )}
        {data && (
          <div className="flex flex-col gap-4">
            <PortfolioSummary metrics={data.metrics} />

            <Separator />

            {data.items.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No contracts in portfolio yet. Add one from the table.
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.items.map((item) => {
                  const c = item.contract;
                  const total =
                    parseFloat(c.quantity_mwh) * parseFloat(c.price_per_mwh);
                  return (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-2 rounded-md border bg-card p-3"
                    >
                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{c.energy_type}</span>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatMwh(c.quantity_mwh)} MWh ·{" "}
                          {formatCurrency(c.price_per_mwh)}/MWh ·{" "}
                          {c.location}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Total: {formatCurrency(total)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemove(c.id)}
                        disabled={remove.isPending}
                        aria-label={`Remove contract ${c.id}`}
                      >
                        <X />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
