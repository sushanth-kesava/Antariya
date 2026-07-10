# Antariya — Inventory Management: End-to-End Test Checklist

This checklist validates every business rule of the warehouse-based, transaction-safe
inventory system across the complete order lifecycle. Work top to bottom; each section
builds on the previous one.

> **Source of truth:** the `Inventory` collection (per warehouse × product × variant).
> `Product.stock` and embedded `variant.stock` are **derived projections** refreshed
> inside each transaction — never written directly. Every mutation writes an immutable
> `InventoryLedger` row and (after commit) emits a Socket.IO event.

---

## 0. Setup

- [ ] `npm install socket.io-client -w frontend` (frontend real-time client)
- [ ] `npm install socket.io -w backend` and `npm install jspdf -w backend` (if not already)
- [ ] `npm run db:migrate-inventory -w backend` — seeds the `DEFAULT` warehouse and backfills `Inventory` rows
- [ ] `npm run dev -w backend` → logs must include:
      - `[realtime] Socket.IO attached — inventory sync ENABLED.`
      - `[inventory.jobs] background jobs started (expiry/verify/low-stock).`
      - `Server Started on port ...`
- [ ] `npm run dev -w frontend`
- [ ] At least one product **with variants and stock** exists (add via admin; Inventory rows are created on first adjustment/migration)

---

## 1. Core order lifecycle

- [ ] **Reserve (order placed)** — Place an order → the SKU's `available` drops by qty, `reserved` rises by qty. Ledger shows a `reserve` row with correct before/after.
- [ ] **Cancel before dispatch (release)** — Cancel a `Processing` order → `reserved` → `available` restored exactly. Ledger `release`.
- [ ] **Dispatch (commit)** — Set order to `Shipped` → `reserved` drops by qty, `available` unchanged. Ledger `commit`.
- [ ] **Cancel after dispatch is blocked** — Try to cancel a `Shipped` order → `409`, no inventory change (must use return flow).
- [ ] **Delivery** — Set `Delivered` → **zero** inventory change.

## 2. Payment & expiry

- [ ] **UPI unpaid expiry** — Create an unpaid UPI hold; wait past `ORDER_HOLD_MINUTES` → expiry sweeper releases the reserved stock and the order is auto-`Cancelled`.
- [ ] **Payment failure** — A failed payment never creates an order → no stock is touched (confirm no orphan `reserve` in the ledger).
- [ ] **Paid / COD never auto-expire** — a paid or COD order keeps its reservation until dispatch/cancel (no `expiresAt`).

## 3. Returns & exchange

- [ ] **Resellable return** — Return that passes QC → `available` rises. Ledger `restock_return`.
- [ ] **Damaged return** — Return that fails QC → `damaged` rises, `available` unchanged. Ledger `damage_return`.
- [ ] **Exchange** — returned item follows the return workflow **and** the replacement SKU deducts (reserve + immediate commit). Both products end with correct stock.
- [ ] **Refund only** — a refund with no return approval makes **no** inventory change.

## 4. Concurrency (the oversell test)

- [ ] Set a variant to `available: 1`. Fire **two simultaneous** orders for it →
      exactly **one** succeeds; the other receives `409 OUT_OF_STOCK`.
      Ledger shows a **single** `reserve`. `available` never goes negative.

## 5. Multi-warehouse

- [ ] **Transfer** — Move stock between two warehouses → source `available` down, destination `available` up, both in a single transaction. Ledger `transfer_out` + `transfer_in`.
- [ ] Buckets tracked per warehouse: `available / reserved / damaged / returned / incoming / inTransit`.

## 6. Product management (admin)

- [ ] **Add / Remove / Set** via admin adjust → correct delta, guarded at zero, ledger row with `previousStock`, `newStock`, `reason`, user, timestamp, warehouse, SKU.
- [ ] Legacy `StockAdjustment` history still populated (mirrored) so the existing admin UI keeps working.
- [ ] Variant products **require** a `variantSku` on adjust (aggregate-only adjust is rejected).

## 7. Real-time sync (open 2 browser tabs)

- [ ] Product page + shop grid open in separate tabs → an order or admin adjustment elsewhere updates the stock badges in **both** with no refresh.
- [ ] `ProductCard` badges ("Out of stock" / "Only N left") update live in every grid (marketplace, shop, homepage).
- [ ] Admin portal → crossing the reorder point shows the live low-stock banner.
- [ ] Superadmin portal → low-stock product count refreshes live.
- [ ] Customer dashboard → wishlist item shows a live "Out of stock" badge.

## 8. Continuous verification job

- [ ] `POST /api/inventory/verify` (as admin) → returns `{ issueCount, issues }`.
- [ ] On a clean database `issueCount: 0`.
- [ ] Detects and reports: negative stock, orphaned reservations, projection drift.

## 9. Audit integrity

- [ ] Every operation above leaves a matching `InventoryLedger` row — query via `GET /api/inventory/ledger` (filters: `productId`, `orderId`, `changeType`).
- [ ] `Product.stock` always equals the sum of `available` across all warehouses (the projection-drift check run by the verify job).
- [ ] No duplicate deductions or restorations on retries (idempotency via the `InventoryReservation` document).

---

## Endpoint reference (all admin/superadmin)

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/inventory/warehouses` | List warehouses |
| POST | `/api/inventory/warehouses` | Create a warehouse |
| GET  | `/api/inventory` | Inventory rows (filters: `warehouse`, `productId`) |
| GET  | `/api/inventory/ledger` | Audit trail (filters: `productId`, `orderId`, `changeType`) |
| POST | `/api/inventory/returns` | Process a return / exchange |
| POST | `/api/inventory/transfer` | Transfer stock between warehouses |
| POST | `/api/inventory/verify` | Run the verification job on demand |

## Socket.IO events

| Event | Audience | Payload |
|---|---|---|
| `inventory:update` | everyone (+ `product:<id>` room) | `{ productId, variantSku, available, reserved, status, at }` |
| `inventory:low-stock` | staff role rooms | `{ count, alerts[], at }` |
| `inventory:alert` | admin + warehouse | `{ kind, issueCount, issues[], at }` |
