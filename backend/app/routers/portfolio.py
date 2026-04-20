from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import cache_get, cache_invalidate, cache_set
from app.crud import portfolio as crud
from app.database import get_db
from app.schemas import (
    PortfolioItemResponse,
    PortfolioResponse,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

PORTFOLIO_CACHE_KEY = "portfolio"


@router.get("", response_model=PortfolioResponse)
async def get_portfolio(db: AsyncSession = Depends(get_db)) -> PortfolioResponse:
    cached = await cache_get(PORTFOLIO_CACHE_KEY)
    if cached is not None:
        return PortfolioResponse.model_validate(cached)

    items = await crud.list_portfolio_items(db)
    metrics = crud.compute_metrics(items)
    response = PortfolioResponse(
        items=[PortfolioItemResponse.model_validate(i) for i in items],
        metrics=metrics,
    )
    await cache_set(PORTFOLIO_CACHE_KEY, response.model_dump(mode="json"))
    return response


@router.post(
    "/{contract_id}",
    response_model=PortfolioItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_contract(
    contract_id: int, db: AsyncSession = Depends(get_db)
) -> PortfolioItemResponse:
    try:
        item = await crud.add_to_portfolio(db, contract_id)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409, detail="Contract already in portfolio"
        )

    if item is None:
        raise HTTPException(status_code=404, detail="Contract not found")

    await cache_invalidate(PORTFOLIO_CACHE_KEY)
    return PortfolioItemResponse.model_validate(item)


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_contract(
    contract_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    removed = await crud.remove_from_portfolio(db, contract_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Contract not in portfolio")
    await cache_invalidate(PORTFOLIO_CACHE_KEY)
