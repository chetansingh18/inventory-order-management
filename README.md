# Inventory & Order Management System

A production-ready, fully containerized full-stack application for managing
**products, customers, orders, and inventory**.

| Layer | Technology |
| --- | --- |
| Frontend | React (JavaScript) + Vite, served by nginx |
| Backend | Python · FastAPI · SQLAlchemy 2.0 |
| Database | PostgreSQL 16 |
| Container | Docker (multi-stage, slim images, non-root) |
| Orchestration | Docker Compose |

---

## Table of Contents
1. [Features](#features)
2. [Architecture](#architecture)
3. [Quick Start (Docker Compose)](#quick-start-docker-compose)
4. [Local Development (without Docker)](#local-development-without-docker)
5. [API Reference](#api-reference)
6. [Business Rules](#business-rules)
7. [Environment Variables](#environment-variables)
8. [Testing](#testing)
9. [Deployment](#deployment)
10. [Project Structure](#project-structure)

---

## Features

- **Products** — full CRUD, unique SKU, price & stock tracking, search.
- **Customers** — create / list / view / delete, unique email.
- **Orders** — multi-line orders, automatic total calculation, automatic
  stock deduction, stock restoration on cancellation, detail view.
- **Dashboard** — totals for products / customers / orders, total revenue,
  and a low-stock watchlist.
- **UX** — responsive layout (desktop + mobile), client- and server-side
  validation, toast notifications, confirm dialogs, loading/empty/error states.

---

## Architecture

```
                 ┌────────────────────────────────────────────┐
  Browser  ─────▶│  frontend  (nginx :80 → host :3000)         │
                 │   • serves the built React SPA              │
                 │   • proxies /api/*  ──────────────┐         │
                 └───────────────────────────────────┼─────────┘
                                                      ▼
                 ┌────────────────────────────────────────────┐
                 │  backend  (FastAPI/gunicorn :8000)          │
                 │   • REST API + business logic               │
                 └───────────────────────────────────┬─────────┘
                                                      ▼
                 ┌────────────────────────────────────────────┐
                 │  db  (PostgreSQL 16, named volume pgdata)   │
                 └────────────────────────────────────────────┘
```

The frontend talks to the backend through the relative path `/api`, which
nginx proxies to the backend container. This keeps the same code working in
local Docker and in split cloud deployments (where `VITE_API_BASE_URL` points
directly at the deployed backend instead).

---

## Quick Start (Docker Compose)

**Prerequisites:** Docker + Docker Compose.

```bash
# 1. Configure environment (credentials are NOT hardcoded)
cp .env.example .env        # edit POSTGRES_PASSWORD etc. if you like

# 2. Build and start everything
docker compose up --build

# 3. Open the apps
#    Frontend : http://localhost:3000
#    API docs : http://localhost:8000/docs
```

Optionally seed demo data:

```bash
docker compose exec backend python seed.py
```

Stop and remove (including the database volume):

```bash
docker compose down -v
```

---

## Local Development (without Docker)

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export DATABASE_URL="postgresql+psycopg2://postgres:postgres@localhost:5432/inventory"
uvicorn app.main:app --reload         # http://localhost:8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev                            # http://localhost:5173 (proxies /api → :8000)
```

---

## API Reference

Base URL: `http://localhost:8000` · Interactive docs at `/docs`.

### Products
| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/products` | Create a product |
| `GET` | `/products` | List all products |
| `GET` | `/products/{id}` | Get one product |
| `PUT` | `/products/{id}` | Update a product |
| `DELETE` | `/products/{id}` | Delete a product |

### Customers
| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/customers` | Create a customer |
| `GET` | `/customers` | List all customers |
| `GET` | `/customers/{id}` | Get one customer |
| `DELETE` | `/customers/{id}` | Delete a customer |

### Orders
| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/orders` | Create an order (deducts stock) |
| `GET` | `/orders` | List all orders |
| `GET` | `/orders/{id}` | Get one order with line items |
| `DELETE` | `/orders/{id}` | Cancel an order (restores stock) |

### Other
| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/dashboard/summary` | Aggregate dashboard metrics |
| `GET` | `/health` | Health check |

**Example — create a product**
```bash
curl -X POST http://localhost:8000/products \
  -H 'Content-Type: application/json' \
  -d '{"name":"Wireless Mouse","sku":"WM-001","price":24.99,"quantity":50}'
```

**Example — create an order**
```bash
curl -X POST http://localhost:8000/orders \
  -H 'Content-Type: application/json' \
  -d '{"customer_id":1,"items":[{"product_id":1,"quantity":3}]}'
```

---

## Business Rules

All rules are enforced server-side (validation + DB constraints) and surfaced
to the UI with clear messages and correct HTTP status codes:

| Rule | Behaviour |
| --- | --- |
| Unique product SKU | Duplicate → `409 Conflict` (SKU is normalised to upper-case) |
| Unique customer email | Duplicate → `409 Conflict` (case-insensitive) |
| Non-negative quantity | Enforced by validation (`422`) and a DB `CHECK` constraint |
| Sufficient inventory | Insufficient stock → `409 Conflict`; order is rejected |
| Automatic stock deduction | Creating an order reduces product stock atomically |
| Stock restoration | Cancelling an order returns its quantities to inventory |
| Server-computed totals | `total_amount` is always calculated by the backend from a price snapshot |
| Validation | All request bodies validated with Pydantic before processing |
| Error handling | Consistent JSON `{"detail": ...}`; unexpected errors → `500` without leaking traces |

---

## Environment Variables

**Root (`.env`, consumed by docker-compose)**

| Variable | Default | Purpose |
| --- | --- | --- |
| `POSTGRES_USER` | `postgres` | Database user |
| `POSTGRES_PASSWORD` | — | Database password (set your own) |
| `POSTGRES_DB` | `inventory` | Database name |
| `CORS_ORIGINS` | localhost set | Allowed frontend origins |
| `LOW_STOCK_THRESHOLD` | `10` | Dashboard low-stock cutoff |

**Backend** (`backend/.env.example`): `DATABASE_URL`, `CORS_ORIGINS`,
`AUTO_CREATE_TABLES`, `LOW_STOCK_THRESHOLD`.

**Frontend** (`frontend/.env.example`): `VITE_API_BASE_URL` (leave empty for
the nginx-proxied setup; set to the public backend URL for split deployments).

---

## Testing

The backend ships with an end-to-end test suite (SQLite in-memory) covering
CRUD, uniqueness, validation, and the inventory/order business rules:

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

---

## Deployment

The project is designed for free hosting tiers.

### Backend → Render (Docker)
1. Push this repo to GitHub.
2. In Render: **New + → Blueprint**, select the repo. The included
   [`render.yaml`](render.yaml) provisions the backend (from
   `backend/Dockerfile`) plus a managed PostgreSQL database and wires
   `DATABASE_URL` automatically.
3. Set `CORS_ORIGINS` to your frontend URL (the backend also auto-allows
   `*.vercel.app` / `*.netlify.app`).
4. Note the public URL, e.g. `https://inventory-backend.onrender.com`.

> Railway / Fly.io work equally well — point them at `backend/Dockerfile` and
> supply `DATABASE_URL`. The app normalises `postgres://` URLs automatically.

### Frontend → Vercel or Netlify
1. Import the repo; set the **root/base directory** to `frontend`.
2. Add environment variable `VITE_API_BASE_URL` = your backend URL.
3. Deploy. SPA routing is handled by [`vercel.json`](frontend/vercel.json) /
   [`netlify.toml`](frontend/netlify.toml).

### Backend image → Docker Hub
```bash
docker build -t <your-dockerhub-user>/inventory-backend:latest ./backend
docker push <your-dockerhub-user>/inventory-backend:latest
```

### Submission checklist
- [ ] GitHub repository link (frontend + backend)
- [ ] Docker Hub image link for the backend
- [ ] Live frontend URL (Vercel/Netlify)
- [ ] Live backend URL (Render/Railway/Fly.io)

---

## Project Structure

```
.
├── docker-compose.yml          # 3-service orchestration (db, backend, frontend)
├── render.yaml                 # Render blueprint (backend + Postgres)
├── .env.example                # Root env (compose credentials)
├── backend/
│   ├── Dockerfile              # slim, non-root, gunicorn+uvicorn
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── seed.py                 # optional demo data
│   ├── app/
│   │   ├── main.py             # app + CORS + error handling + lifespan
│   │   ├── config.py           # env-driven settings
│   │   ├── database.py         # engine/session, URL normalisation
│   │   ├── models.py           # SQLAlchemy models + constraints
│   │   ├── schemas.py          # Pydantic validation schemas
│   │   └── routers/            # products, customers, orders, dashboard
│   └── tests/test_api.py       # end-to-end tests
└── frontend/
    ├── Dockerfile              # multi-stage build → nginx
    ├── nginx.conf              # static serving + /api proxy + SPA fallback
    ├── .dockerignore
    ├── vercel.json / netlify.toml
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── api/client.js       # typed fetch wrapper
        ├── context/            # toast notifications
        ├── components/         # Modal, ConfirmDialog, States
        └── pages/              # Dashboard, Products, Customers, Orders
```
