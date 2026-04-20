import { apiFetch } from "./client";
import type { Portfolio, PortfolioItem } from "../types";

export const fetchPortfolio = (): Promise<Portfolio> =>
  apiFetch<Portfolio>("/portfolio");

export const addToPortfolio = (contractId: number): Promise<PortfolioItem> =>
  apiFetch<PortfolioItem>(`/portfolio/${contractId}`, { method: "POST" });

export const removeFromPortfolio = (contractId: number): Promise<void> =>
  apiFetch<void>(`/portfolio/${contractId}`, { method: "DELETE" });
