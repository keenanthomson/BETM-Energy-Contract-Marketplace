import { apiFetch } from "./client";
import type { EnumValues } from "../types";

export const fetchEnums = (): Promise<EnumValues> =>
  apiFetch<EnumValues>("/meta/enums");
