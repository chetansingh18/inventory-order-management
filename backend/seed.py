"""Optional helper to populate the database with demo data.

Run inside the backend container:
    docker compose exec backend python seed.py
"""
from decimal import Decimal

from app.database import Base, SessionLocal, engine
from app import models


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.Product).count() > 0:
            print("Data already present; skipping seed.")
            return

        products = [
            models.Product(name="Wireless Mouse", sku="WM-001", price=Decimal("24.99"), quantity=50),
            models.Product(name="Mechanical Keyboard", sku="KB-002", price=Decimal("79.00"), quantity=30),
            models.Product(name="USB-C Hub", sku="HUB-003", price=Decimal("39.50"), quantity=8),
            models.Product(name="27\" Monitor", sku="MON-004", price=Decimal("219.00"), quantity=5),
            models.Product(name="Laptop Stand", sku="LS-005", price=Decimal("32.00"), quantity=0),
        ]
        customers = [
            models.Customer(full_name="Alice Johnson", email="alice@example.com", phone="555-0101"),
            models.Customer(full_name="Bob Smith", email="bob@example.com", phone="555-0102"),
        ]
        db.add_all(products + customers)
        db.commit()
        print("Seeded demo products and customers.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
