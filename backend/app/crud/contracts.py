from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Contract
from app.schemas import ContractStatus, ContractUpdate, EnergyType, GridZone


async def list_contracts(
    db: AsyncSession,
    energy_type: EnergyType | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    min_quantity: Decimal | None = None,
    max_quantity: Decimal | None = None,
    location: GridZone | None = None,
    status: ContractStatus | None = None,
    delivery_start_after: date | None = None,
    delivery_end_before: date | None = None,
) -> list[Contract]:
    query = select(Contract)

    if energy_type is not None:
        query = query.where(Contract.energy_type == energy_type.value)
    if min_price is not None:
        query = query.where(Contract.price_per_mwh >= min_price)
    if max_price is not None:
        query = query.where(Contract.price_per_mwh <= max_price)
    if min_quantity is not None:
        query = query.where(Contract.quantity_mwh >= min_quantity)
    if max_quantity is not None:
        query = query.where(Contract.quantity_mwh <= max_quantity)
    if location is not None:
        query = query.where(Contract.location == location.value)
    if status is not None:
        query = query.where(Contract.status == status.value)
    if delivery_start_after is not None:
        query = query.where(Contract.delivery_start >= delivery_start_after)
    if delivery_end_before is not None:
        query = query.where(Contract.delivery_end <= delivery_end_before)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_contract(db: AsyncSession, contract_id: int) -> Contract | None:
    result = await db.execute(select(Contract).where(Contract.id == contract_id))
    return result.scalar_one_or_none()


async def update_contract(
    db: AsyncSession, contract_id: int, data: ContractUpdate
) -> Contract | None:
    contract = await get_contract(db, contract_id)
    if contract is None:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        # enum values are stored as their string value
        if hasattr(value, "value"):
            value = value.value
        setattr(contract, field, value)

    await db.commit()
    await db.refresh(contract)
    return contract
