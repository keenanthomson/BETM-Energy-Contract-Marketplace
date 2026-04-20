from collections.abc import AsyncGenerator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.database import get_db
from app.main import app
from app.models import Base, Contract


@pytest.fixture
async def test_engine():
    """In-memory SQLite engine shared across the test.

    StaticPool keeps a single connection alive so schema + data created
    in one session is visible from another session in the same test.
    """
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def test_session_factory(test_engine):
    return async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture
async def async_client(
    test_session_factory,
) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with test_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
async def seeded_contracts(test_session_factory) -> list[Contract]:
    """Small, deterministic fixture set covering each enum value we assert on."""
    today = date.today()
    contracts = [
        Contract(
            energy_type="Solar",
            quantity_mwh=Decimal("100.000"),
            price_per_mwh=Decimal("25.00"),
            delivery_start=today + timedelta(days=10),
            delivery_end=today + timedelta(days=40),
            location="Texas",
            status="Available",
        ),
        Contract(
            energy_type="Solar",
            quantity_mwh=Decimal("50.000"),
            price_per_mwh=Decimal("55.00"),
            delivery_start=today + timedelta(days=20),
            delivery_end=today + timedelta(days=60),
            location="California",
            status="Pending",
        ),
        Contract(
            energy_type="Wind",
            quantity_mwh=Decimal("200.000"),
            price_per_mwh=Decimal("40.00"),
            delivery_start=today + timedelta(days=5),
            delivery_end=today + timedelta(days=35),
            location="Texas",
            status="Available",
        ),
        Contract(
            energy_type="Natural Gas",
            quantity_mwh=Decimal("300.000"),
            price_per_mwh=Decimal("90.00"),
            delivery_start=today + timedelta(days=30),
            delivery_end=today + timedelta(days=120),
            location="Northeast",
            status="Sold",
        ),
        Contract(
            energy_type="Hydro",
            quantity_mwh=Decimal("150.000"),
            price_per_mwh=Decimal("30.00"),
            delivery_start=today + timedelta(days=15),
            delivery_end=today + timedelta(days=75),
            location="Northwest",
            status="Available",
        ),
    ]

    async with test_session_factory() as session:
        session.add_all(contracts)
        await session.commit()
        for c in contracts:
            await session.refresh(c)

    return contracts
