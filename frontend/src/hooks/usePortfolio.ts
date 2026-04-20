import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addToPortfolio,
  fetchPortfolio,
  removeFromPortfolio,
} from "../api/portfolio";
import type { Portfolio } from "../types";

export const portfolioQueryKey = ["portfolio"] as const;

export const usePortfolio = () =>
  useQuery<Portfolio>({
    queryKey: portfolioQueryKey,
    queryFn: fetchPortfolio,
  });

export const useAddToPortfolio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addToPortfolio,
    onSuccess: () => qc.invalidateQueries({ queryKey: portfolioQueryKey }),
  });
};

export const useRemoveFromPortfolio = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: removeFromPortfolio,
    onSuccess: () => qc.invalidateQueries({ queryKey: portfolioQueryKey }),
  });
};
