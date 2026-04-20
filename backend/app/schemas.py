from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class EnergyType(str, Enum):
    solar = "Solar"
    wind = "Wind"
    natural_gas = "Natural Gas"
    hydro = "Hydro"
    nuclear = "Nuclear"


class ContractStatus(str, Enum):
    available = "Available"
    pending = "Pending"
    sold = "Sold"


class GridZone(str, Enum):
    texas = "Texas"
    california = "California"
    northeast = "Northeast"
    midwest = "Midwest"
    southeast = "Southeast"
    southwest = "Southwest"
    northwest = "Northwest"
    mid_atlantic = "Mid-Atlantic"
    great_plains = "Great Plains"
    rocky_mountains = "Rocky Mountains"


class ContractBase(BaseModel):
    energy_type: EnergyType
    quantity_mwh: Decimal = Field(gt=0)
    price_per_mwh: Decimal = Field(gt=0)
    delivery_start: date
    delivery_end: date
    location: GridZone
    status: ContractStatus


class ContractUpdate(BaseModel):
    status: ContractStatus | None = None


class ContractResponse(ContractBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class PortfolioItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    contract_id: int
    contract: ContractResponse


class PortfolioMetrics(BaseModel):
    total_contracts: int
    total_capacity_mwh: Decimal
    total_cost: Decimal
    weighted_avg_price: Decimal
    breakdown_by_type: dict[str, Decimal]


class PortfolioResponse(BaseModel):
    items: list[PortfolioItemResponse]
    metrics: PortfolioMetrics


class EnumValuesResponse(BaseModel):
    energy_types: list[str]
    statuses: list[str]
    grid_zones: list[str]
