from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Contract, PortfolioItem
from app.schemas import PortfolioMetrics


async def list_portfolio_items(db: AsyncSession) -> list[PortfolioItem]:
    result = await db.execute(
        select(PortfolioItem).options(selectinload(PortfolioItem.contract))
    )
    return list(result.scalars().all())


async def add_to_portfolio(
    db: AsyncSession, contract_id: int
) -> PortfolioItem | None:
    """Returns None if contract doesn't exist. Raises if already in portfolio
    (unique constraint on contract_id)."""
    contract = await db.get(Contract, contract_id)
    if contract is None:
        return None

    item = PortfolioItem(contract_id=contract_id)
    db.add(item)
    await db.commit()

    # reload with contract relationship eagerly loaded
    result = await db.execute(
        select(PortfolioItem)
        .where(PortfolioItem.id == item.id)
        .options(selectinload(PortfolioItem.contract))
    )
    return result.scalar_one()


async def remove_from_portfolio(db: AsyncSession, contract_id: int) -> bool:
    result = await db.execute(
        select(PortfolioItem).where(PortfolioItem.contract_id == contract_id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        return False

    await db.delete(item)
    await db.commit()
    return True


async def is_in_portfolio(db: AsyncSession, contract_id: int) -> bool:
    result = await db.execute(
        select(PortfolioItem.id).where(PortfolioItem.contract_id == contract_id)
    )
    return result.scalar_one_or_none() is not None


def compute_metrics(items: list[PortfolioItem]) -> PortfolioMetrics:
    if not items:
        return PortfolioMetrics(
            total_contracts=0,
            total_capacity_mwh=Decimal("0"),
            total_cost=Decimal("0"),
            weighted_avg_price=Decimal("0"),
            breakdown_by_type={},
        )

    total_capacity = Decimal("0")
    total_cost = Decimal("0")
    breakdown: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))

    for item in items:
        c = item.contract
        qty = c.quantity_mwh
        cost = qty * c.price_per_mwh

        total_capacity += qty
        total_cost += cost
        breakdown[c.energy_type] += qty

    weighted_avg = (
        (total_cost / total_capacity).quantize(Decimal("0.01"))
        if total_capacity > 0
        else Decimal("0")
    )

    return PortfolioMetrics(
        total_contracts=len(items),
        total_capacity_mwh=total_capacity,
        total_cost=total_cost,
        weighted_avg_price=weighted_avg,
        breakdown_by_type=dict(breakdown),
    )
