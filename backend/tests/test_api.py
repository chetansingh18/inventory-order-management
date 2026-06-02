"""End-to-end API tests running against an in-memory SQLite database.

Run with:  cd backend && pip install -r requirements-dev.txt && pytest
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_product_crud_and_unique_sku(client):
    r = client.post("/products", json={"name": "Mouse", "sku": "wm-1", "price": 9.99, "quantity": 5})
    assert r.status_code == 201
    assert r.json()["sku"] == "WM-1"  # normalized to upper-case

    # Duplicate SKU rejected.
    dup = client.post("/products", json={"name": "Other", "sku": "WM-1", "price": 1, "quantity": 1})
    assert dup.status_code == 409

    pid = r.json()["id"]
    upd = client.put(f"/products/{pid}", json={"price": 12.50})
    assert upd.status_code == 200
    assert float(upd.json()["price"]) == 12.50

    assert client.get(f"/products/{pid}").status_code == 200
    assert client.get("/products/9999").status_code == 404


def test_negative_quantity_rejected(client):
    r = client.post("/products", json={"name": "X", "sku": "X1", "price": 1, "quantity": -3})
    assert r.status_code == 422


def test_unique_customer_email(client):
    r = client.post("/customers", json={"full_name": "A", "email": "a@x.com", "phone": "1"})
    assert r.status_code == 201
    dup = client.post("/customers", json={"full_name": "B", "email": "A@x.com", "phone": "2"})
    assert dup.status_code == 409  # case-insensitive


def test_order_reduces_stock_and_blocks_oversell(client):
    p = client.post("/products", json={"name": "Pen", "sku": "P1", "price": 2.00, "quantity": 10}).json()
    c = client.post("/customers", json={"full_name": "C", "email": "c@x.com"}).json()

    order = client.post("/orders", json={"customer_id": c["id"], "items": [{"product_id": p["id"], "quantity": 4}]})
    assert order.status_code == 201
    assert float(order.json()["total_amount"]) == 8.00

    # Stock reduced from 10 to 6.
    assert client.get(f"/products/{p['id']}").json()["quantity"] == 6

    # Oversell blocked.
    bad = client.post("/orders", json={"customer_id": c["id"], "items": [{"product_id": p["id"], "quantity": 100}]})
    assert bad.status_code == 409

    # Deleting an order restocks.
    oid = order.json()["id"]
    assert client.delete(f"/orders/{oid}").status_code == 204
    assert client.get(f"/products/{p['id']}").json()["quantity"] == 10


def test_dashboard_summary(client):
    client.post("/products", json={"name": "Low", "sku": "L1", "price": 1, "quantity": 2})
    summary = client.get("/dashboard/summary").json()
    assert summary["total_products"] == 1
    assert summary["low_stock_count"] == 1
