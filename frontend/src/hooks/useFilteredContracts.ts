import { useMemo } from "react";
import { useContracts } from "./useContracts";
import { useFilterStore } from "../store/useFilterStore";
import type { Contract } from "../types";

const safeNum = (v: number | null): number | null =>
  v !== null && !Number.isNaN(v) ? v : null;

export const useFilteredContracts = (): {
  contracts: Contract[];
  total: number;
  count: number;
} => {
  const { data: all = [] } = useContracts();
  const filters = useFilterStore((s) => s.filters);

  const contracts = useMemo(() => {
    const minPrice = safeNum(filters.min_price);
    const maxPrice = safeNum(filters.max_price);
    const minQty = safeNum(filters.min_quantity);
    const maxQty = safeNum(filters.max_quantity);

    return all.filter((c) => {
      if (
        filters.energy_types.length &&
        !filters.energy_types.includes(c.energy_type)
      )
        return false;
      if (filters.locations.length && !filters.locations.includes(c.location))
        return false;
      if (filters.statuses.length && !filters.statuses.includes(c.status))
        return false;

      const price = parseFloat(c.price_per_mwh);
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;

      const qty = parseFloat(c.quantity_mwh);
      if (minQty !== null && qty < minQty) return false;
      if (maxQty !== null && qty > maxQty) return false;

      // YYYY-MM-DD sorts lexicographically, so string compare is safe
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
  }, [all, filters]);

  return { contracts, total: all.length, count: contracts.length };
};
