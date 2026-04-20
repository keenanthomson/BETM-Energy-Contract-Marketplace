import { apiFetch } from "./client";
import type { Contract, ContractUpdate } from "../types";

export const fetchContracts = (): Promise<Contract[]> =>
  apiFetch<Contract[]>("/contracts");

export const updateContract = (
  id: number,
  data: ContractUpdate,
): Promise<Contract> =>
  apiFetch<Contract>(`/contracts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
