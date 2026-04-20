"""
Seed the database with ~1,000 realistic energy contracts.
Run with: uv run python seed.py
"""

import asyncio
import random
from datetime import date, timedelta

from app.database import async_session, engine
from app.models import Base, Contract

# --- Enum values (mirrored from schemas.py) ---
ENERGY_TYPES = ["Solar", "Wind", "Natural Gas", "Hydro", "Nuclear"]
STATUSES = ["Available", "Pending", "Sold"]
GRID_ZONES = [
    "Texas",
    "California",
    "Northeast",
    "Midwest",
    "Southeast",
    "Southwest",
    "Northwest",
    "Mid-Atlantic",
    "Great Plains",
    "Rocky Mountains",
]

# Realistic price ranges per energy type ($/MWh)
PRICE_RANGES: dict[str, tuple[float, float]] = {
    "Solar": (20.0, 60.0),
    "Wind": (25.0, 65.0),
    "Natural Gas": (40.0, 120.0),
    "Hydro": (15.0, 45.0),
    "Nuclear": (30.0, 80.0),
}

# Weighted status distribution: 70% Available, 20% Pending, 10% Sold
STATUS_WEIGHTS = [70, 20, 10]


def random_date_pair() -> tuple[date, date]:
    """Generate a random delivery_start and delivery_end within the next 24 months."""
    today = date.today()
    start_offset = random.randint(1, 700)
    duration = random.randint(7, 180)
    delivery_start = today + timedelta(days=start_offset)
    delivery_end = delivery_start + timedelta(days=duration)
    return delivery_start, delivery_end


def generate_contracts(n: int = 1000) -> list[Contract]:
    contracts = []
    for _ in range(n):
        energy_type = random.choice(ENERGY_TYPES)
        low, high = PRICE_RANGES[energy_type]
        delivery_start, delivery_end = random_date_pair()
        status = random.choices(STATUSES, weights=STATUS_WEIGHTS)[0]

        contracts.append(
            Contract(
                energy_type=energy_type,
                quantity_mwh=round(random.uniform(10.0, 500.0), 3),
                price_per_mwh=round(random.uniform(low, high), 2),
                delivery_start=delivery_start,
                delivery_end=delivery_end,
                location=random.choice(GRID_ZONES),
                status=status,
            )
        )
    return contracts


async def seed() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        contracts = generate_contracts(1000)
        session.add_all(contracts)
        await session.commit()

    print(f"Seeded {len(contracts)} contracts successfully.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
