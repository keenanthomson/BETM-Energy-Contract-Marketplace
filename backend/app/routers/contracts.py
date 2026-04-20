from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import contracts as crud
from app.database import get_db
from app.schemas import (
    ContractResponse,
    ContractStatus,
    ContractUpdate,
    EnergyType,
    GridZone,
)

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.get("", response_model=list[ContractResponse])
async def list_contracts(
    db: AsyncSession = Depends(get_db),
    energy_type: EnergyType | None = None,
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    min_quantity: Decimal | None = Query(None, ge=0),
    max_quantity: Decimal | None = Query(None, ge=0),
    location: GridZone | None = None,
    status: ContractStatus | None = None,
    delivery_start_after: date | None = None,
    delivery_end_before: date | None = None,
) -> list[ContractResponse]:
    items = await crud.list_contracts(
        db,
        energy_type=energy_type,
        min_price=min_price,
        max_price=max_price,
        min_quantity=min_quantity,
        max_quantity=max_quantity,
        location=location,
        status=status,
        delivery_start_after=delivery_start_after,
        delivery_end_before=delivery_end_before,
    )
    return [ContractResponse.model_validate(c) for c in items]


@router.get("/{contract_id}", response_model=ContractResponse)
async def get_contract(
    contract_id: int, db: AsyncSession = Depends(get_db)
) -> ContractResponse:
    contract = await crud.get_contract(db, contract_id)
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    return ContractResponse.model_validate(contract)


@router.put("/{contract_id}", response_model=ContractResponse)
async def update_contract(
    contract_id: int,
    data: ContractUpdate,
    db: AsyncSession = Depends(get_db),
) -> ContractResponse:
    contract = await crud.update_contract(db, contract_id, data)
    if contract is None:
        raise HTTPException(status_code=404, detail="Contract not found")
    return ContractResponse.model_validate(contract)
