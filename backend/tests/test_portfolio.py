from decimal import Decimal


async def test_add_to_portfolio(async_client, seeded_contracts):
    cid = seeded_contracts[0].id
    r = await async_client.post(f"/portfolio/{cid}")
    assert r.status_code == 201
    body = r.json()
    assert body["contract_id"] == cid
    assert body["contract"]["id"] == cid


async def test_add_nonexistent_contract_returns_404(async_client, seeded_contracts):
    r = await async_client.post("/portfolio/999999")
    assert r.status_code == 404


async def test_add_duplicate_returns_409(async_client, seeded_contracts):
    cid = seeded_contracts[0].id
    r1 = await async_client.post(f"/portfolio/{cid}")
    assert r1.status_code == 201
    r2 = await async_client.post(f"/portfolio/{cid}")
    assert r2.status_code == 409


async def test_remove_from_portfolio(async_client, seeded_contracts):
    cid = seeded_contracts[0].id
    await async_client.post(f"/portfolio/{cid}")
    r = await async_client.delete(f"/portfolio/{cid}")
    assert r.status_code == 204

    # now it's removable → next delete is 404
    r2 = await async_client.delete(f"/portfolio/{cid}")
    assert r2.status_code == 404


async def test_empty_portfolio_metrics(async_client, seeded_contracts):
    r = await async_client.get("/portfolio")
    assert r.status_code == 200
    body = r.json()
    assert body["items"] == []
    metrics = body["metrics"]
    assert metrics["total_contracts"] == 0
    assert Decimal(metrics["total_capacity_mwh"]) == 0
    assert Decimal(metrics["total_cost"]) == 0
    assert metrics["breakdown_by_type"] == {}


async def test_portfolio_metrics(async_client, seeded_contracts):
    # Add Solar(100 @ $25) + Wind(200 @ $40) + Solar(50 @ $55)
    # total_capacity = 350; total_cost = 2500 + 8000 + 2750 = 13250
    # weighted_avg = 13250 / 350 = 37.857... → 37.86 (quantized to 0.01)
    # breakdown: Solar = 150, Wind = 200
    solar1, solar2, wind, *_ = seeded_contracts
    for c in (solar1, solar2, wind):
        r = await async_client.post(f"/portfolio/{c.id}")
        assert r.status_code == 201

    r = await async_client.get("/portfolio")
    body = r.json()
    metrics = body["metrics"]

    assert metrics["total_contracts"] == 3
    assert Decimal(metrics["total_capacity_mwh"]) == Decimal("350")
    assert Decimal(metrics["total_cost"]) == Decimal("13250.00")
    assert Decimal(metrics["weighted_avg_price"]) == Decimal("37.86")
    assert Decimal(metrics["breakdown_by_type"]["Solar"]) == Decimal("150")
    assert Decimal(metrics["breakdown_by_type"]["Wind"]) == Decimal("200")

    # contract relationship is eagerly loaded in the response
    assert len(body["items"]) == 3
    assert all("contract" in item for item in body["items"])


async def test_portfolio_item_survives_separate_get(
    async_client, seeded_contracts
):
    cid = seeded_contracts[2].id
    await async_client.post(f"/portfolio/{cid}")
    r = await async_client.get("/portfolio")
    ids = [i["contract_id"] for i in r.json()["items"]]
    assert ids == [cid]
