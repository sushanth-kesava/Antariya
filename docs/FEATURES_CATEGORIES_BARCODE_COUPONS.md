# Feature Implementation — Categories, Barcode Lifecycle & Restricted Coupons

This document covers the three features added on top of the existing Antariya
platform, the APIs, the migration, and a full testing checklist.

> **Architecture note:** The codebase already had a barcode subsystem
> (`Barcode` model + `barcode.service.js`) and a public coupon system. These
> features **extend** those rather than replacing them, preserving backward
> compatibility. Every change defaults existing data to its current behaviour.

---

## 1. Product Category Management (nested)

### Database
- **New model:** `backend/src/models/Category.js`
  - `name`, `slug` (unique), `description`, `icon`
  - `parentId` (nullable) — Parent → Child nesting
  - `ancestors[]` + `path` (materialized, e.g. `/collections/anime-collection`) → subtree queries via indexed prefix, no recursion
  - `level`, `order`, `active`, `showInNav`, `productCount`
- **Product model** gained `categoryId` + `subCategoryId` (ObjectId refs). The
  legacy string fields `category` / `subCategory` are **kept** for backward
  compatibility and denormalized display. Renames propagate to products.

### APIs (`/api/categories`)
| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| GET | `/api/categories` | Public | Nested tree. `?flat=1` flat list, `?active=1`, `?nav=1`, `?search=term` |
| GET | `/api/categories/:slug/products` | Public | Products in a category **and all descendants** |
| POST | `/api/categories` | admin/superadmin | Create category (top-level or child via `parentId`) |
| PATCH | `/api/categories/:id` | admin/superadmin | Update; slug rename cascades path + product denormalized names |
| DELETE | `/api/categories/:id` | admin/superadmin | Delete; `?cascade=1` to include sub-categories. Products are **un-categorized, never deleted** |
| POST | `/api/categories/recount` | admin/superadmin | Refresh `productCount` |

### Frontend
- API client: `frontend/src/lib/api/categories.ts`
- Admin UI: **Superadmin → Categories** (`CategoriesModule.tsx`) — nested tree, create form (with parent selector), active + nav toggles, safe delete.
- Product creation resolves `categoryId`/`subCategoryId` automatically.

### Migration (no data loss)
```bash
cd backend
npm run db:migrate-categories
```
- Seeds the canonical tree (mirrors `frontend/src/lib/categories.ts`).
- Back-fills every product's `categoryId`/`subCategoryId` by matching existing
  strings. Anything unmatched goes to an **"Uncategorized"** bucket — nothing lost.
- Idempotent: existing categories are matched by slug and reused.

---

## 2. Barcode Lifecycle

### Problem fixed
Products auto-generated a barcode on create, but **deleting a product left
orphan barcode records** (and any stored images). Now cleaned up atomically.

### Changes
- `barcode.service.js` → new `deleteProductBarcodes(productId, { session })`:
  removes all `Barcode` records for a product and destroys any Cloudinary
  barcode images (`_extractCloudinaryPublicId` + `cloudinary.destroyAsset`).
  Base64/data-URI images are inline and vanish with the record.
- `cloudinary.service.js` → new `destroyAsset(publicId)` (best-effort).
- `product.controller.js` → `deleteProduct` now runs inside a **MongoDB
  transaction**:
  ```
  Delete Barcode records → Delete Barcode files → Delete Product   (atomic)
  ```
  Falls back to sequential deletes on standalone MongoDB (no replica set).

### Lifecycle (unchanged create side)
```
Create Product → auto-generate SKU → generate CODE128 barcode → attach
Delete Product → delete barcode records → delete barcode files → delete product
```

---

## 3. Private / Restricted Coupons

### Database (`Coupon` model)
- `visibility`: `"public"` (default, backward compatible) | `"restricted"`
- `allowedEmails[]`: lowercase, de-duplicated allow-list (used only when restricted)

### Admin (`Superadmin → Coupons & Offers`)
- **Coupon Visibility** selector: *Public Coupon* / *Restricted Coupon*
- When restricted:
  - **Allowed Emails** textarea (comma / newline separated)
  - **CSV upload** — parses, validates, de-duplicates; shows import status + live valid count
- Backend normalizes/validates emails and stores the clean list.

### Validation flow (checkout)
```
Customer logs in → applies coupon
   → coupon.visibility === "restricted"?
        → email in allowedEmails?  yes → continue
                                   no  → 403 "This coupon is not available for your account."
   → normal checks (active, dates, usage, min order, min qty) → apply discount
```
- Restricted coupons are **excluded** from the public homepage hero banner.

### API
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/coupons` | Now accepts `visibility`, `allowedEmails` (string or array) |
| PATCH | `/api/coupons/:id` | Switching to public clears the allow-list |
| POST | `/api/coupons/validate` | Enforces the email allow-list for restricted coupons |

---

## Testing Checklist

### Categories
- [ ] `npm run db:migrate-categories` seeds tree; products get `categoryId`; unmatched land in "Uncategorized"; re-running is safe.
- [ ] `GET /api/categories` returns nested tree; `?flat=1` returns flat list.
- [ ] Create top-level + child category (via Superadmin → Categories).
- [ ] `GET /api/categories/:slug/products` returns products from the subtree.
- [ ] Rename a parent category → child `path` + product `category` strings update.
- [ ] Delete a category with children without `cascade` → blocked (409); with cascade → children removed, products un-categorized (not deleted).
- [ ] Toggle `active` / `showInNav` reflects on storefront + nav.

### Barcodes
- [ ] Create a product → a `Barcode` record is created (check DB / Barcode module).
- [ ] Delete the product → **no** `Barcode` records remain for that productId.
- [ ] If Cloudinary configured: barcode image asset is destroyed.
- [ ] On a replica set: product+barcode deletion is atomic (fail midway → nothing deleted). On standalone Mongo: sequential fallback still cleans up.

### Restricted Coupons
- [ ] Create a **public** coupon → any logged-in customer can apply.
- [ ] Create a **restricted** coupon with allowed emails (textarea + CSV).
- [ ] Allowed customer → coupon applies.
- [ ] Non-allowed customer → `403 "This coupon is not available for your account."`
- [ ] Restricted coupon does **not** appear in the homepage hero banner.
- [ ] CSV upload de-duplicates and skips invalid emails (status shown).
- [ ] Switch a restricted coupon back to public → allow-list cleared.

### Regression
- [ ] Existing public coupons still validate & apply.
- [ ] Existing products still display with their string categories.
- [ ] `npm test` (backend) passes the schema/slug/barcode unit tests.

---

## Files Changed / Added

**Backend**
- `models/Category.js` *(new)*, `models/Product.js` (added refs), `models/Coupon.js` (visibility/allowedEmails)
- `controllers/category.controller.js` *(new)*, `controllers/product.controller.js` (category resolve + delete transaction), `controllers/coupon.controller.js` (restricted logic)
- `services/barcode.service.js` (deleteProductBarcodes), `services/cloudinary.service.js` (destroyAsset)
- `routes/category.routes.js` *(new)*, `routes/coupon.routes.js` (schema), `schemas/coupon.schemas.js`
- `scripts/migrate-categories.js` *(new)*, `server.js` (mount categories), `package.json` (script)
- `tests/features.test.js` *(new)*

**Frontend**
- `lib/api/categories.ts` *(new)*, `lib/api/coupons.ts` (types)
- `app/portal/superadmin/modules/CategoriesModule.tsx` *(new)*, `modules/CouponsModule.tsx` (restricted UI)
- `app/portal/superadmin/ErpShell.tsx` (nav + routing)
