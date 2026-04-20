from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import portfolio as crud
from app.database import get_db
from app.schemas import (
    PortfolioItemResponse,
    PortfolioResponse,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("", response_model=PortfolioResponse)
async def get_portfolio(db: AsyncSession = Depends(get_db)) -> PortfolioResponse:
    items = await crud.list_portfolio_items(db)
    metrics = crud.compute_metrics(items)
    return PortfolioResponse(
        items=[PortfolioItemResponse.model_validate(i) for i in items],
        metrics=metrics,
    )


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

    return PortfolioItemResponse.model_validate(item)


@router.delete("/{contract_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_contract(
    contract_id: int, db: AsyncSession = Depends(get_db)
) -> None:
    removed = await crud.remove_from_portfolio(db, contract_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Contract not in portfolio")
