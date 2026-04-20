import { useMemo } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiError } from "@/api/client";
import { useFilteredContracts } from "@/hooks/useFilteredContracts";
import { useContracts } from "@/hooks/useContracts";
import { useAddToPortfolio, usePortfolio } from "@/hooks/usePortfolio";
import { useFilterStore } from "@/store/useFilterStore";
import { formatCurrency, formatDate, formatMwh } from "@/lib/format";
import { energyColor } from "@/lib/colors";

export function ContractTable() {
  const { isLoading, isError, error } = useContracts();
  const { contracts, count, total } = useFilteredContracts();
  const portfolio = usePortfolio();
  const addMutation = useAddToPortfolio();
  const resetFilters = useFilterStore((s) => s.resetFilters);

  const inPortfolio = useMemo(
    () => new Set(portfolio.data?.items.map((i) => i.contract_id) ?? []),
    [portfolio.data],
  );

  const handleAdd = (contractId: number) => {
    addMutation.mutate(contractId, {
      onSuccess: () => toast.success("Added to portfolio"),
      onError: (err) => {
        const msg =
          err instanceof ApiError ? err.message : "Failed to add contract";
        toast.error(msg);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        Loading contracts…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-destructive">
        Failed to load contracts: {error?.message ?? "unknown error"}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2 text-sm text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">{count}</span>{" "}
          of {total} contracts
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        {count === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-sm text-muted-foreground">
            No contracts match your filters.
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset filters
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Energy Type</TableHead>
                <TableHead className="text-right">Quantity (MWh)</TableHead>
                <TableHead className="text-right">Price ($/MWh)</TableHead>
                <TableHead>Delivery Start</TableHead>
                <TableHead>Delivery End</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((c) => {
                const already = inPortfolio.has(c.id);
                const available = c.status === "Available";
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ backgroundColor: energyColor(c.energy_type) }}
                        />
                        {c.energy_type}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMwh(c.quantity_mwh)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.price_per_mwh)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(c.delivery_start)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(c.delivery_end)}
                    </TableCell>
                    <TableCell>{c.location}</TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={already ? "outline" : "default"}
                        disabled={already || !available || addMutation.isPending}
                        onClick={() => handleAdd(c.id)}
                      >
                        {already ? (
                          "In Portfolio"
                        ) : (
                          <>
                            <PlusIcon /> Add
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
