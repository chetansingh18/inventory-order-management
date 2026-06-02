"""Order endpoints with inventory-aware business logic."""
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/orders", tags=["orders"])


def _serialize_order(order: models.Order) -> schemas.OrderOut:
    items = [
        schemas.OrderItemOut(
            id=item.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            product_name=item.product.name if item.product else None,
            line_total=Decimal(item.unit_price) * item.quantity,
        )
        for item in order.items
    ]
    return schemas.OrderOut(
        id=order.id,
        customer_id=order.customer_id,
        total_amount=order.total_amount,
        status=order.status,
        created_at=order.created_at,
        items=items,
        customer_name=order.customer.full_name if order.customer else None,
    )


@router.post("", response_model=schemas.OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(payload: schemas.OrderCreate, db: Session = Depends(get_db)):
    customer = db.get(models.Customer, payload.customer_id)
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Customer not found")

    # Merge duplicate product lines so stock checks see the true demand.
    merged: dict[int, int] = {}
    for item in payload.items:
        merged[item.product_id] = merged.get(item.product_id, 0) + item.quantity

    order = models.Order(customer_id=customer.id, total_amount=Decimal("0"), status="confirmed")
    total = Decimal("0")

    for product_id, qty in merged.items():
        product = db.get(models.Product, product_id)
        if product is None:
            raise HTTPException(
                status.HTTP_404_NOT_FOUND, detail=f"Product {product_id} not found"
            )
        if product.quantity < qty:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=(
                    f"Insufficient stock for '{product.name}': "
                    f"requested {qty}, available {product.quantity}"
                ),
            )
        # Automatically reduce available stock.
        product.quantity -= qty
        line_price = Decimal(product.price)
        total += line_price * qty
        order.items.append(
            models.OrderItem(
                product_id=product.id, quantity=qty, unit_price=line_price
            )
        )

    # Backend always computes the total; client-supplied totals are ignored.
    order.total_amount = total
    db.add(order)
    db.commit()

    order = db.scalar(
        select(models.Order)
        .where(models.Order.id == order.id)
        .options(selectinload(models.Order.items).selectinload(models.OrderItem.product))
        .options(selectinload(models.Order.customer))
    )
    return _serialize_order(order)


@router.get("", response_model=list[schemas.OrderOut])
def list_orders(db: Session = Depends(get_db)):
    orders = db.scalars(
        select(models.Order)
        .order_by(models.Order.id.desc())
        .options(selectinload(models.Order.items).selectinload(models.OrderItem.product))
        .options(selectinload(models.Order.customer))
    ).all()
    return [_serialize_order(o) for o in orders]


@router.get("/{order_id}", response_model=schemas.OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.scalar(
        select(models.Order)
        .where(models.Order.id == order_id)
        .options(selectinload(models.Order.items).selectinload(models.OrderItem.product))
        .options(selectinload(models.Order.customer))
    )
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Order not found")
    return _serialize_order(order)


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.scalar(
        select(models.Order)
        .where(models.Order.id == order_id)
        .options(selectinload(models.Order.items))
    )
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Order not found")

    # Cancelling an order returns the reserved stock to inventory.
    for item in order.items:
        product = db.get(models.Product, item.product_id)
        if product is not None:
            product.quantity += item.quantity

    db.delete(order)
    db.commit()
    return None
