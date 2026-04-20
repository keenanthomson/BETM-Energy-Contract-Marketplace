import { useQuery } from "@tanstack/react-query";
import { fetchEnums } from "../api/meta";
import type { EnumValues } from "../types";

export const enumsQueryKey = ["enums"] as const;

export const useEnums = () =>
  useQuery<EnumValues>({
    queryKey: enumsQueryKey,
    queryFn: fetchEnums,
    staleTime: Infinity,
  });
