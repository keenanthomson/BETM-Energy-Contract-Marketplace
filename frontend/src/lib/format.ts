/**
 * Format a YYYY-MM-DD string for display without triggering UTC-midnight
 * timezone shifts (e.g. `new Date("2026-03-01")` renders as Feb 28 in ET).
 */
export const formatDate = (d: string): string => {
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y}`;
};

export const formatCurrency = (value: string | number): string => {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
};

export const formatMwh = (value: string | number): string => {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return n.toLocaleString("en-US", { maximumFractionDigits: 3 });
};
