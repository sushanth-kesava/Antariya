# Data Flow Reference & API Integration Guide

**Date**: 2025-06-26  
**Purpose**: Quick reference for understanding how data moves through the system

---

## Quick Reference: Request/Response Flow

### Pattern 1: Read from Odoo (Products, Inventory)

```
CLIENT REQUEST
    ↓
Frontend: GET /api/products
    ↓
Backend Route: productRoutes
    ↓
Controller: productController.getProducts()
    ↓
Service: productService.getProducts()
    ↓
Odoo Client: client.call("product.product", "search", [...])
    ↓
ODOO (XML-RPC)
    ↓
Response: [product1, product2, ...]
    ↓
Transform: transformProduct(odooData) → API format
    ↓
Return: {success: true, products: [...]}
    ↓
CLIENT RESPONSE ✅
```

### Pattern 2: Create Order (Local MongoDB + Odoo)

```
CLIENT REQUEST
    ↓
Frontend: POST /api/orders {items: [...]}
    ↓
Backend Route: orderRoutes
    ↓
Middleware:
  • requireAuth (JWT validation)
  • Validate token
    ↓
Controller: orderController.createOrder()
  • Validate order items
  • Calculate totals
    ↓
MongoDB Operation:
  • Save order document
  • Link to user
    ↓
If dealer involved:
  ↓
Service: salesService.createSalesOrder()
  ↓
Odoo Operation:
  • client.call("sale.order", "create", {...})
  • Link products, customer, shipping
    ↓
ODOO RESPONSE
  • Order ID created
  • Default state: "draft"
    ↓
Return: {success: true, order: {...}}
    ↓
CLIENT RESPONSE ✅
```

### Pattern 3: Authenticate User (Google OAuth)

```
CLIENT REQUEST
    ↓
Frontend: POST /api/auth/google {googleAccessToken: "..."}
    ↓
Backend: authController.loginWithGoogle()
    ↓
Verify Google token (via googleapis library)
    ↓
Extract: email, displayName, photoURL
    ↓
MongoDB: User.findOne({email})
    ↓
[User found?]
├─ YES → Update lastLogin, return existing user
└─ NO → Create new user with role: "customer"
    ↓
Service: customerService.createOrSyncCustomer()
    ↓
Odoo Operation:
  • Search res.partner by email
  • If not found: create new partner
  • Sync name, email, phone
    ↓
Generate JWT token
    ↓
Return: {success: true, token: "jwt...", user: {...}}
    ↓
CLIENT RESPONSE ✅
```

### Pattern 4: Fetch Dashboard Analytics (Cached)

```
CLIENT REQUEST
    ↓
Frontend: GET /api/dashboard/snapshot
    ↓
Backend: dashboardController.getDashboardSnapshot()
    ↓
Service: dashboardService.getDashboardSnapshot()
    ↓
[Check in-memory cache]
├─ HIT (within TTL) → Return cached data immediately ⚡
└─ MISS (expired/new) → Fetch fresh data
    ↓
Execute 8 metrics in parallel:
  • getTodaysSales()
  • getMonthlySales()
  • getTopProducts()
  • getLowStockProducts()
  • getPendingOrders()
  • getRevenue()
  • getCustomerStats()
  • getProfit()
    ↓
Each metric:
  • client.call() → Odoo
  • Transform response
  • Store in cache with TTL
    ↓
Combine all results
    ↓
Return: {
  today: {...},
  monthly: {...},
  topProducts: [...],
  ...
}
    ↓
CLIENT RESPONSE ✅
```

---

## Endpoint Usage Examples

### Create Order

**Request**:
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "123",
        "quantity": 2,
        "customization": {
          "symbol": "symbol",
          "threadColor": "blue",
          "fabricColor": "white",
          "size": "Medium",
          "placement": "front"
        }
      }
    ]
  }'
```

**Response** (Success):
```json
{
  "success": true,
  "order": {
    "id": "order_abc123",
    "items": [
      {
        "productId": "123",
        "dealerId": "dealer_1",
        "name": "Product Name",
        "price": 500,
        "quantity": 2,
        "customization": {...}
      }
    ],
    "subtotal": 1000,
    "shipping": 99,
    "tax": 180,
    "total": 1279,
    "status": "pending",
    "createdAt": "2025-06-26T10:00:00Z"
  }
}
```

**Response** (Error):
```json
{
  "success": false,
  "error": "Product with ID 123 not found",
  "type": "validation",
  "timestamp": "2025-06-26T10:00:00Z"
}
```

### Get Products from Odoo

**Request**:
```bash
curl -X GET "http://localhost:5000/api/odoo/products?limit=20&offset=0" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "products": [
    {
      "id": 1,
      "name": "Embroidered Saree",
      "sku": "SAR-001",
      "description": "Traditional embroidered saree",
      "category": "Dresses",
      "categoryId": 5,
      "price": 2500,
      "cost": 1200,
      "images": ["image_url_1", "image_url_2"],
      "variants": [1, 2, 3],
      "barcode": "123456789",
      "active": true,
      "type": "product",
      "uom": "Unit"
    }
  ],
  "pagination": {
    "total": 150,
    "offset": 0,
    "limit": 20
  }
}
```

### Search Products

**Request**:
```bash
curl -X GET "http://localhost:5000/api/odoo/products/search?q=embroidered" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "results": [
    {
      "id": 1,
      "name": "Embroidered Saree",
      "sku": "SAR-001",
      "price": 2500,
      "category": "Dresses"
    }
  ]
}
```

### Get Inventory by Product

**Request**:
```bash
curl -X GET "http://localhost:5000/api/inventory/product/123" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "inventory": {
    "productId": 123,
    "productName": "Embroidered Saree",
    "totalStock": 50,
    "warehouses": [
      {
        "id": 1,
        "name": "Main Warehouse",
        "quantity": 30,
        "reserved": 5,
        "available": 25
      },
      {
        "id": 2,
        "name": "Secondary Warehouse",
        "quantity": 20,
        "reserved": 0,
        "available": 20
      }
    ]
  }
}
```

### Create Sales Order in Odoo

**Request**:
```bash
curl -X POST http://localhost:5000/api/odoo/sales \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": 42,
    "lines": [
      {
        "productId": 123,
        "quantity": 2,
        "price": 2500,
        "discount": 10
      }
    ],
    "notes": "Custom embroidery requested",
    "shippingAmount": 150
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 501,
    "name": "SO-2025-0501",
    "customerId": 42,
    "customerName": "John Doe",
    "orderDate": "2025-06-26",
    "state": "draft",
    "subtotal": 5000,
    "tax": 900,
    "total": 6050,
    "lines": [...]
  }
}
```

### Confirm Sales Order

**Request**:
```bash
curl -X POST http://localhost:5000/api/odoo/sales/501/confirm \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "message": "Sales order confirmed successfully",
  "data": {
    "id": 501,
    "state": "sale",
    "invoiced": "invoiced",
    "...": "..."
  }
}
```

### Get Dashboard Snapshot

**Request**:
```bash
curl -X GET http://localhost:5000/api/dashboard/snapshot \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "data": {
    "today": {
      "salesCount": 15,
      "totalAmount": 45000,
      "orders": [...]
    },
    "monthly": {
      "total": 450000,
      "byWeek": [...]
    },
    "topProducts": [
      {
        "id": 1,
        "name": "Embroidered Saree",
        "revenue": 125000,
        "quantitySold": 50
      }
    ],
    "lowStockProducts": [...],
    "pendingOrders": [...],
    "revenue": {
      "allTime": 5000000,
      "monthly": 450000,
      "growth": 12.5
    },
    "customers": {
      "total": 5000,
      "new": 250,
      "active": 3500
    },
    "profit": {
      "margin": 35.5,
      "monthOverMonth": 8.2
    }
  }
}
```

### Create Shipment

**Request**:
```bash
curl -X POST http://localhost:5000/api/shipping \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "salesOrderId": 501,
    "courierPartner": "shiprocket"
  }'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "ship_001",
    "salesOrderId": 501,
    "status": "created",
    "trackingNumber": "SR123456789",
    "provider": "shiprocket",
    "createdAt": "2025-06-26T10:00:00Z"
  }
}
```

### Get Tracking Info

**Request**:
```bash
curl -X GET http://localhost:5000/api/shipping/ship_001/tracking \
  -H "Content-Type: application/json"
```

**Response**:
```json
{
  "success": true,
  "tracking": {
    "shipmentId": "ship_001",
    "trackingNumber": "SR123456789",
    "status": "in_transit",
    "currentLocation": "Delhi",
    "lastUpdate": "2025-06-26T14:30:00Z",
    "estimatedDelivery": "2025-06-28",
    "events": [
      {
        "timestamp": "2025-06-26T10:00:00Z",
        "status": "picked_up",
        "location": "Warehouse - Delhi"
      },
      {
        "timestamp": "2025-06-26T14:30:00Z",
        "status": "in_transit",
        "location": "Delhi"
      }
    ]
  }
}
```

---

## Common Error Responses

### 400 Bad Request (Validation Error)

```json
{
  "success": false,
  "error": "At least one order line is required",
  "type": "validation",
  "timestamp": "2025-06-26T10:00:00Z"
}
```

### 401 Unauthorized (Missing Token)

```json
{
  "success": false,
  "error": "Authorization token is required",
  "type": "auth",
  "timestamp": "2025-06-26T10:00:00Z"
}
```

### 403 Forbidden (Insufficient Permissions)

```json
{
  "success": false,
  "error": "You do not have permission to perform this action.",
  "type": "permission",
  "timestamp": "2025-06-26T10:00:00Z"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Product with ID 999 not found",
  "type": "not_found",
  "timestamp": "2025-06-26T10:00:00Z"
}
```

### 429 Too Many Requests (Rate Limited)

```json
{
  "success": false,
  "error": "Too many login attempts. Please try again later.",
  "type": "rate_limit",
  "timestamp": "2025-06-26T10:00:00Z"
}
```

### 500 Server Error

```json
{
  "success": false,
  "error": "Failed to create sales order",
  "type": "server",
  "timestamp": "2025-06-26T10:00:00Z"
}
```

---

## Authentication & Authorization

### JWT Token Format

**Header**:
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload**:
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "role": "customer|admin|superadmin",
  "iat": 1719406800,
  "exp": 1719493200
}
```

### Role-Based Access

| Endpoint Pattern | Customer | Admin | Superadmin |
|-----------------|----------|-------|-----------|
| GET /products | ✅ | ✅ | ✅ |
| POST /products | ❌ | ✅ | ✅ |
| DELETE /products | ❌ | ✅ | ✅ |
| GET /orders/my | ✅ | ✅ | ✅ |
| GET /orders/admin/dashboard | ❌ | ✅ | ✅ |
| PATCH /orders/admin/:id/status | ❌ | ✅ | ✅ |
| POST /products/:id/reviews | ✅ | ✅ | ✅ |
| GET /products/admin/reviews | ❌ | ✅ | ✅ |
| GET /superadmin/dashboard | ❌ | ❌ | ✅ |

---

## Testing Checklist

- [ ] Test product listing without auth
- [ ] Test product creation with admin token
- [ ] Test product creation without admin token (should fail)
- [ ] Create order with valid items
- [ ] Create order with invalid product ID (should fail)
- [ ] Create order with quantity 0 (should fail)
- [ ] Test Google OAuth flow
- [ ] Test JWT token expiration
- [ ] Test rate limiting on login endpoint
- [ ] Test dashboard snapshot caching (first hit vs cached hit)
- [ ] Test Odoo inventory sync
- [ ] Test sales order creation in Odoo
- [ ] Test shipment creation and tracking
- [ ] Test invalid delivery pincode
- [ ] Test review creation eligibility
- [ ] Test superadmin access requests

---

## Performance Notes

### Dashboard Caching (In-Memory TTL)

| Metric | TTL | Freshness |
|--------|-----|-----------|
| Today's Sales | 5 min | High |
| Monthly Sales | 30 min | Medium |
| Top Products | 1 hour | Low |
| Low Stock | 15 min | Medium |
| Pending Orders | 5 min | High |
| Revenue | 30 min | Medium |
| Customers | 1 hour | Low |
| Profit | 30 min | Medium |

**Snapshot Endpoint**: Fetches all 8 metrics in parallel using `Promise.all()`. First hit fetches from Odoo, subsequent hits within TTL windows return cached data.

### Rate Limiting Thresholds

- **Auth routes**: 100 requests per 15 minutes per IP
- **Credentials (login/signup)**: 10 requests per 15 minutes per IP
- **Other endpoints**: Configurable per-endpoint

---

## Environment Variables Required

```bash
# Odoo Integration
ODOO_URL=http://odoo.example.com
ODOO_DB=odoo_database
ODOO_USERNAME=admin
ODOO_PASSWORD=password

# MongoDB
MONGODB_URI=mongodb://localhost:27017/antariya

# JWT & Auth
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=google-client-id
GOOGLE_CLIENT_SECRET=google-client-secret

# Frontend
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000

# Services
RAZORPAY_KEY_ID=rzp_live_key
RAZORPAY_KEY_SECRET=rzp_live_secret
CLOUDINARY_CLOUD_NAME=cloud-name
CLOUDINARY_API_KEY=api-key
CLOUDINARY_API_SECRET=api-secret

# Shipping
SHIPROCKET_API_KEY=shiprocket-key
SHIPROCKET_API_SECRET=shiprocket-secret
```

---

**Last Updated**: 2025-06-26  
**Version**: 1.0
