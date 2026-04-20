export interface Contract {
  id: number;
  energy_type: string;
  quantity_mwh: string;
  price_per_mwh: string;
  delivery_start: string;
  delivery_end: string;
  location: string;
  status: string;
}

export interface EnumValues {
  energy_types: string[];
  statuses: string[];
  grid_zones: string[];
}

export interface PortfolioItem {
  id: number;
  contract_id: number;
  contract: Contract;
}

export interface PortfolioMetrics {
  total_contracts: number;
  total_capacity_mwh: string;
  total_cost: string;
  weighted_avg_price: string;
  breakdown_by_type: Record<string, string>;
}

export interface Portfolio {
  items: PortfolioItem[];
  metrics: PortfolioMetrics;
}

export interface ContractFilters {
  energy_types: string[];
  min_price: number | null;
  max_price: number | null;
  min_quantity: number | null;
  max_quantity: number | null;
  locations: string[];
  delivery_start_after: string | null;
  delivery_end_before: string | null;
  statuses: string[];
}

export interface ContractUpdate {
  status?: string;
}
