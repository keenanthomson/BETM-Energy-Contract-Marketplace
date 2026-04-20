from decimal import Decimal

import pytest


async def test_list_contracts(async_client, seeded_contracts):
    r = await async_client.get("/contracts")
    assert r.status_code == 200
    assert len(r.json()) == len(seeded_contracts)


async def test_filter_by_energy_type(async_client, seeded_contracts):
    r = await async_client.get("/contracts", params={"energy_type": "Solar"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert all(c["energy_type"] == "Solar" for c in data)


async def test_filter_by_price_range(async_client, seeded_contracts):
    r = await async_client.get(
        "/contracts", params={"min_price": 30, "max_price": 60}
    )
    assert r.status_code == 200
    data = r.json()
    assert all(30 <= Decimal(c["price_per_mwh"]) <= 60 for c in data)
    assert {c["energy_type"] for c in data} == {"Solar", "Wind", "Hydro"}


async def test_filter_by_price_range_zero_lower_bound(
    async_client, seeded_contracts
):
    r = await async_client.get("/contracts", params={"min_price": 0})
    assert r.status_code == 200
    assert len(r.json()) == len(seeded_contracts)


async def test_filter_by_quantity_range(async_client, seeded_contracts):
    r = await async_client.get(
        "/contracts", params={"min_quantity": 100, "max_quantity": 200}
    )
    assert r.status_code == 200
    data = r.json()
    assert all(100 <= Decimal(c["quantity_mwh"]) <= 200 for c in data)


async def test_filter_by_location(async_client, seeded_contracts):
    r = await async_client.get("/contracts", params={"location": "Texas"})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert all(c["location"] == "Texas" for c in data)


async def test_filter_by_status(async_client, seeded_contracts):
    r = await async_client.get("/contracts", params={"status": "Available"})
    data = r.json()
    assert all(c["status"] == "Available" for c in data)
    assert len(data) == 3


async def test_filter_combined(async_client, seeded_contracts):
    r = await async_client.get(
        "/contracts",
        params={
            "energy_type": "Solar",
            "status": "Available",
            "location": "Texas",
        },
    )
    data = r.json()
    assert len(data) == 1
    assert data[0]["energy_type"] == "Solar"
    assert data[0]["location"] == "Texas"


@pytest.mark.parametrize(
    "param,value",
    [
        ("energy_type", "Coal"),
        ("status", "Unknown"),
        ("location", "Atlantis"),
        ("min_price", "-10"),
        ("max_price", "-1"),
        ("min_quantity", "-5"),
        ("max_quantity", "-3"),
    ],
)
async def test_filter_invalid_values_return_422(
    async_client, seeded_contracts, param, value
):
    r = await async_client.get("/contracts", params={param: value})
    assert r.status_code == 422


async def test_get_contract_by_id(async_client, seeded_contracts):
    cid = seeded_contracts[0].id
    r = await async_client.get(f"/contracts/{cid}")
    assert r.status_code == 200
    assert r.json()["id"] == cid


async def test_get_contract_not_found(async_client, seeded_contracts):
    r = await async_client.get("/contracts/999999")
    assert r.status_code == 404


async def test_update_contract_status(async_client, seeded_contracts):
    cid = seeded_contracts[0].id
    r = await async_client.put(f"/contracts/{cid}", json={"status": "Sold"})
    assert r.status_code == 200
    assert r.json()["status"] == "Sold"


async def test_update_contract_invalid_status_returns_422(
    async_client, seeded_contracts
):
    cid = seeded_contracts[0].id
    r = await async_client.put(f"/contracts/{cid}", json={"status": "Nope"})
    assert r.status_code == 422


async def test_update_contract_not_found(async_client, seeded_contracts):
    r = await async_client.put("/contracts/999999", json={"status": "Sold"})
    assert r.status_code == 404


async def test_meta_enums(async_client):
    r = await async_client.get("/meta/enums")
    assert r.status_code == 200
    body = r.json()
    assert "Solar" in body["energy_types"]
    assert "Available" in body["statuses"]
    assert "Texas" in body["grid_zones"]
