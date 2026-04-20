/**
 * Single source of truth for colors shared between the contract table,
 * portfolio breakdown bar chart, and filter panel (status dot indicators).
 */

// Keep energy and status palettes disjoint — Pending (amber) previously matched
// Solar exactly, so Solar is moved to yellow and Natural Gas to a deeper brick.
export const ENERGY_COLORS: Record<string, string> = {
  Solar: "#eab308", // yellow
  Wind: "#0ea5e9", // sky
  "Natural Gas": "#b45309", // dark amber / brick
  Hydro: "#0284c7", // blue
  Nuclear: "#8b5cf6", // violet
};

export const STATUS_COLORS: Record<string, string> = {
  Available: "#10b981", // emerald
  Pending: "#f59e0b", // amber
  Sold: "#ef4444", // red
};

export const energyColor = (type: string): string =>
  ENERGY_COLORS[type] ?? "#6b7280"; // fallback gray

export const statusColor = (status: string): string =>
  STATUS_COLORS[status] ?? "#6b7280";
