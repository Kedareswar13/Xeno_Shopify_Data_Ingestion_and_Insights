# Xeno Shopify Insights

A full‑stack analytics platform for Shopify stores. It ingests orders/customers/products from Shopify into Postgres via a Node/Express backend, then presents actionable dashboards in a modern Next.js frontend.

This README covers:
- What the project does and architecture
- Exact dependency versions in use
- Local development setup (with and without Docker)
- Environment variables
- Running, building, and deploying
- Data sync and troubleshooting

---

## 1) Project Overview

- Backend (`backend/`): Node.js + Express, Prisma ORM (PostgreSQL), background sync from Shopify REST Admin API, multi‑tenant aware. Exposes REST endpoints for analytics, recent orders, top products, new/returning split, sales by product type/vendor, traffic heatmap, discounts, and sync controls.
- Frontend (`frontend/`): Next.js 13 App Router, React 18, Tailwind + shadcn‑style UI components. Uses TanStack Query for on‑page queries; critical flows hard‑reload on certain actions to avoid stale UI after sync.
- Database: PostgreSQL 15 (Docker compose provided). Prisma migrations and schema live in `backend/prisma/`.
- Docker: `docker-compose.yml` provisions Postgres and PgAdmin for local dev.

Key features implemented:
- Dashboard with stats and Sales Overview chart
- Recent Orders, Top Products, Top Customers (computed from orders)
- AOV KPI, Discounts Impact, Sales by Product Type/Vendor, Customers: New vs Returning, Traffic Heatmap (Orders/Revenue)
- Store list with connect + manual sync (triggers hard reload for freshness)
- Auth with OTP email verification and multi‑tenant store access checks
- AI features placeholders (predict performance, sentiment analysis) with API hooks ready

---

## 2) Tech Stack and Versions

Backend (file: `backend/package.json`):
- Node: >= 18 (engines)
- Typescript: ^5.2.2
- Express: ^4.21.2
- Prisma: ^6.16.1 (CLI + @prisma/client)
- Axios: ^1.12.1
- date-fns: ^4.1.0
- jsonwebtoken: ^9.0.2
- express-validator: ^7.0.1, helmet: ^7.1.0, cors: ^2.8.5, pino: ^8.17.1
- Shopify API SDK: @shopify/shopify-api ^11.14.1
- Dev tooling: ts-node-dev ^2.0.0, eslint ^8.56.0, jest ^29.7.0

Frontend (file: `frontend/package.json`):
- Next.js: ^13.4.19, React: ^18.2.0, TypeScript: 5.9.2
- TanStack Query: ^4.41.0
- Tailwind CSS: ^3.3.3 (+ typography and animate), PostCSS: ^8.4.31
- Recharts: ^3.2.0
- Shopify UI: @shopify/polaris ^13.9.5, App Bridge React ^4.2.2
- date-fns: ^2.30.0
- Icons: lucide-react ^0.544.0

Database/Infra:
- PostgreSQL 15 (Docker image: `postgres:15-alpine`)
- PgAdmin (Docker image: `dpage/pgadmin4:latest`)

---

## 3) Architecture (High Level)

```
frontend/ (Next.js)
  └─ src/
     ├─ app/dashboard/page.tsx        # Dashboard: mounts SalesOverview + new analytics widgets
     ├─ components/dashboard/...      # Analytics components (SalesOverview, AOVKpi, DiscountsImpact, SalesByType, CustomerSplit, TrafficHeatmap, RecentOrders, TopProducts)
     └─ lib/shopify.ts                # REST client wrapper to backend

backend/ (Express)
  ├─ src/services/shopify.service.ts  # Shopify REST client + sync services
  ├─ src/controllers/                 # dashboard + sync controllers (sales, customers, products, heatmap, discounts)
  ├─ src/routes/shopify.routes.ts     # API routes (/api/shopify/...)
  ├─ prisma/schema.prisma             # DB models: Store, Order, Product, Customer, Event
  └─ utils/prisma.ts                  # Prisma client
```

Data flow (example for Sales Overview):
1. Frontend calls `GET /api/shopify/stores/:storeId/sales?startDate=...&endDate=...`.
2. Backend aggregates `orders` by `createdAt` day and returns daily sales and order counts.
3. Frontend renders a continuous line chart with zero-filled days and dark styling.

Order dates: The backend persists Shopify `created_at` (or `processed_at` fallback) into `orders.createdAt`, ensuring UI dates match Shopify. New/Returning logic is time‑range aware: first order in range is "New" if there are no pre‑range orders; subsequent orders in range are "Returning".

---

## 4) Prerequisites

- Node.js 18+
- PNPM/Yarn/NPM (choose your package manager)
- Docker Desktop (optional but recommended for Postgres)

---

## 5) Environment Variables

Create `backend/.env` (example):
```
# Postgres (match docker-compose or your own instance)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/xeno_shopify_insights?schema=public

# JWT / Sessions (if auth endpoints are enabled)
JWT_SECRET=please-change-me
SESSION_SECRET=please-change-me

# Shopify app credentials
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_SCOPES=read_products,read_customers,read_orders

# App URLs (adjust ports as needed)
BACKEND_BASE_URL=http://localhost:4000
FRONTEND_BASE_URL=http://localhost:3000

# SMTP (optional if email/OTP flows are used)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM="Xeno Insights <no-reply@xeno.com>"
```

Create `frontend/.env.local` (example):
```
# Frontend calls backend through this base
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Note: If your code already centralizes API base in `frontend/src/lib/api.ts`, keep it consistent.

---

## 6) Running Locally

### Option A: With Docker (recommended for DB)

1) Start Postgres + PgAdmin:
```bash
docker compose up -d
```
- Postgres: `localhost:5432`, db: `xeno_shopify_insights`, user/pass: `postgres`/`postgres`
- PgAdmin: `http://localhost:5050` (admin@xeno.com / admin123)

2) Install deps:
```bash
# backend
cd backend
npm install

# frontend
cd ../frontend
npm install
```

3) Generate Prisma client and run migrations (backend):
```bash
cd ../backend
npm run prisma:generate
npm run prisma:migrate
```

4) Start backend and frontend in separate terminals:
```bash
# terminal 1
cd backend
npm run dev   # starts Express on http://localhost:4000 (check your app.ts)

# terminal 2
cd frontend
npm run dev   # starts Next.js on http://localhost:3000
```

5) Open the app:
- Frontend: http://localhost:3000
- Dashboard: http://localhost:3000/dashboard
- Stores: http://localhost:3000/stores

### Option B: Without Docker
- Ensure you have a local Postgres and set `DATABASE_URL` accordingly.
- Follow steps 2–5 above.

---

## 7) Seeding and Syncing Data

- Prisma Studio (inspect DB):
```bash
cd backend
npm run prisma:studio
```

- Manual Shopify sync endpoints (dev routes are available without auth):
  - Kick off background sync of everything:
    ```http
    POST /api/shopify/stores/:storeId/sync
    ```
  - Orders sync for a given range (backfill/correct createdAt):
    ```http
    POST /api/shopify/stores/:storeId/sync/orders?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
    ```

- The frontend Stores page also triggers a background sync when expanding a store row.

---

## 8) Useful Scripts

Backend (`backend/package.json`):
- `npm run dev` – Start Express with ts-node-dev
- `npm run build && npm start` – Build to `dist/` and run
- `npm run prisma:generate` – Generate Prisma client
- `npm run prisma:migrate` – Apply migrations
- `npm run prisma:studio` – Prisma Studio
- `npm run type-check` – TS type check
- `npm run lint` – ESLint
- `npm test` – Jest tests

Frontend (`frontend/package.json`):
- `npm run dev` – Next.js dev server
- `npm run build` – Next build
- `npm start` – Next start
- `npm run lint` – Next/ESLint

---

## 9) Deployment Notes

- Build backend:
```bash
cd backend
npm run build
```
Run with `node dist/app.js` and provide production `.env`.

- Build frontend:
```bash
cd frontend
npm run build
npm start
```

- Database: Use managed Postgres (e.g., RDS, Cloud SQL). Set `DATABASE_URL` and run `npm run prisma:migrate` on boot or via CI/CD.

- Environment security: Do not commit secrets. Use platform secret managers.

---

## 10) Troubleshooting

- "Dates look wrong in UI":
  - Ensure you have re-synced orders. The backend persists Shopify `created_at` into `orders.createdAt` during upsert. Backfill with the orders sync endpoint for historical range.

- "Chart looks flat":
  - Confirm orders exist in the selected range. Try a wider date range. The Sales Overview fetches server-aggregated data for the exact `startDate/endDate` window.

- "Cannot connect to Postgres":
  - Check `docker compose ps`, verify port 5432 is free. Update `DATABASE_URL` accordingly.

- "Shopify 401/403":
  - Verify `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and `SHOPIFY_SCOPES`. Ensure the store access token is set on the `stores` table and domain is correct.

---

## 11) API Glance (Key Endpoints)

Base: `/api/shopify`

- `GET /stores/:storeId/analytics` – Totals for cards
- `GET /stores/:storeId/products/top?limit=5` – Top products by sold units
- `GET /stores/:storeId/orders/recent?limit=20` – Recent orders
- `GET /stores/:storeId/customers/insights` – Top customers by spend
- `GET /stores/:storeId/sales?startDate=ISO&endDate=ISO` – Sales aggregated by day for charts
- `POST /stores/:storeId/sync` – Background sync all
- `POST /stores/:storeId/sync/orders?startDate=ISO&endDate=ISO` – Sync orders for range

---

## 12) Conventions

- Code style: ESLint + Prettier. Run `lint` before commits.
- Commit messages: Conventional style preferred (feat, fix, chore).
- Imports: Project uses `tsconfig-paths` and `@` alias in backend.

---

## 13) License

Private project. All rights reserved.
