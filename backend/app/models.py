from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[int] = mapped_column(primary_key=True)
    energy_type: Mapped[str] = mapped_column(String(50), index=True)
    quantity_mwh: Mapped[Decimal] = mapped_column(Numeric(12, 3), index=True)
    price_per_mwh: Mapped[Decimal] = mapped_column(Numeric(10, 2), index=True)
    delivery_start: Mapped[date] = mapped_column(Date, index=True)
    delivery_end: Mapped[date] = mapped_column(Date, index=True)
    location: Mapped[str] = mapped_column(String(100), index=True)
    status: Mapped[str] = mapped_column(String(20), index=True)

    portfolio_item: Mapped["PortfolioItem | None"] = relationship(
        back_populates="contract", uselist=False
    )


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    __table_args__ = (UniqueConstraint("contract_id", name="uq_portfolio_contract"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id"))

    contract: Mapped["Contract"] = relationship(back_populates="portfolio_item")
