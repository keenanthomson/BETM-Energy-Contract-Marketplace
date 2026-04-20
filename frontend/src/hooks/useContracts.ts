import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchContracts, updateContract } from "../api/contracts";
import type { Contract, ContractUpdate } from "../types";

export const contractsQueryKey = ["contracts"] as const;

export const useContracts = () =>
  useQuery<Contract[]>({
    queryKey: contractsQueryKey,
    queryFn: fetchContracts,
    staleTime: 1000 * 60 * 5,
  });

export const useUpdateContract = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ContractUpdate }) =>
      updateContract(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractsQueryKey });
    },
  });
};
