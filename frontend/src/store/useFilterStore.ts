import { create } from "zustand";
import type { ContractFilters } from "../types";

interface FilterStore {
  filters: ContractFilters;
  setFilter: <K extends keyof ContractFilters>(
    key: K,
    value: ContractFilters[K],
  ) => void;
  toggleInArray: (
    key: "energy_types" | "locations" | "statuses",
    value: string,
  ) => void;
  resetFilters: () => void;
  activeFilterCount: () => number;
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

export const useFilterStore = create<FilterStore>((set, get) => ({
  filters: defaultFilters,
  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),
  toggleInArray: (key, value) =>
    set((s) => {
      const current = s.filters[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { filters: { ...s.filters, [key]: next } };
    }),
  resetFilters: () => set({ filters: defaultFilters }),
  activeFilterCount: () => {
    const f = get().filters;
    let count = 0;
    if (f.energy_types.length) count++;
    if (f.locations.length) count++;
    if (f.statuses.length) count++;
    if (f.min_price !== null) count++;
    if (f.max_price !== null) count++;
    if (f.min_quantity !== null) count++;
    if (f.max_quantity !== null) count++;
    if (f.delivery_start_after !== null) count++;
    if (f.delivery_end_before !== null) count++;
    return count;
  },
}));
