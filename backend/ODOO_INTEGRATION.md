# Odoo Integration - Complete Architecture & Production Guidelines

**Premium Fashion Brand ERP Integration Framework**
Last Updated: 2026-06-26

## Table of Contents
1. [Overview](#overview)
2. [Folder Structure](#folder-structure)
3. [Core Architecture](#core-architecture)
4. [Production Features](#production-features)
5. [API Endpoints](#api-endpoints)
6. [Best Practices](#best-practices)
7. [Deployment Checklist](#deployment-checklist)

---

## Overview

This is a production-grade Odoo integration framework for a premium fashion e-commerce platform. It provides:

- **Real-time Data Sync** — Live product, inventory, customer, order, and shipping data from Odoo
- **Multi-Provider Support** — Extensible shipping provider architecture (Shiprocket, DHL, FedEx, etc.)
- **Business Analytics** — Comprehensive dashboard with caching and performance optimization
- **Enterprise Security** — Input validation, rate limiting, error handling, secure credential management
- **Scalability** — Caching strategies, connection pooling, retry mechanisms, circuit breakers
- **Maintainability** — SOLID principles, clear separation of concerns, comprehensive documentation

---

## Folder Structure

### Organized for Scale

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js                    # MongoDB configuration
│   │   ├── env.js                   # Legacy env config (deprecate in favor of config-manager)
│   │   ├── odoo.js                  # Odoo configuration
│   │   └── config-manager.js        # ✨ NEW: Centralized config with validation
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js       # Authentication
│   │   ├── error.middleware.js      # Legacy error handling (replace with error-handler)
│   │   ├── error-handler.middleware.js  # ✨ NEW: Unified error handling
│   │   ├── validation.middleware.js     # ✨ NEW: Input validation schemas
│   │   ├── rate-limit.middleware.js     # ✨ NEW: API rate limiting
│   │   └── rate-limiter.middleware.js   # Legacy (replace with rate-limit)
│   │
│   ├── services/
│   │   ├── odoo/                    # Odoo integration services
│   │   │   ├── odoo.client.js       # Core XML-RPC client
│   │   │   ├── auth.service.js      # Odoo authentication (singleton)
│   │   │   ├── product.service.js   # Product catalog
│   │   │   ├── inventory.service.js # Stock tracking
│   │   │   ├── customer.service.js  # Customer management
│   │   │   ├── sales.service.js     # Sales orders
│   │   │   ├── purchase.service.js  # Purchase orders
│   │   │   ├── accounting.service.js# Invoicing & GST
│   │   │   ├── shipping.service.js  # Shipment management
│   │   │   └── dashboard.service.js # ✨ NEW: Analytics & metrics
│   │   │
│   │   └── shipping/                # Shipping provider abstraction
│   │       ├── base.provider.js     # Abstract provider interface
│   │       ├── shiprocket.provider.js
│   │       ├── dhl.provider.js      # Future
│   │       └── index.js             # Provider factory
│   │
│   ├── controllers/                 # HTTP request handlers
│   │   ├── odoo-product.controller.js
│   │   ├── odoo-inventory.controller.js
│   │   ├── odoo-customer.controller.js
│   │   ├── odoo-sales.controller.js
│   │   ├── odoo-purchase.controller.js
│   │   ├── odoo-accounting.controller.js
│   │   ├── odoo-shipping.controller.js
│   │   └── odoo-dashboard.controller.js  # ✨ NEW
│   │
│   ├── routes/                      # Express route definitions
│   │   ├── odoo-product.routes.js
│   │   ├── odoo-inventory.routes.js
│   │   ├── odoo-customer.routes.js
│   │   ├── odoo-sales.routes.js
│   │   ├── odoo-purchase.routes.js
│   │   ├── odoo-accounting.routes.js
│   │   ├── odoo-shipping.routes.js
│   │   └── odoo-dashboard.routes.js # ✨ NEW
│   │
│   ├── utils/                       # Utility functions
│   │   ├── retry.util.js            # ✨ NEW: Exponential backoff & retry logic
│   │   └── logger.util.js           # Future: Centralized logging
│   │
│   ├── models/                      # MongoDB schemas
│   │   ├── User.js
│   │   ├── Order.js
│   │   └── ...
│   │
│   └── server.js                    # Express app initialization
│
├── package.json                     # Dependencies
├── SHIPPING_MODULE.md              # Shipping module documentation
├── ODOO_INTEGRATION.md             # ✨ NEW: Complete integration guide
└── .env.example                    # Environment variable template
```

### Key Improvements

✅ **Centralized Configuration** — `config-manager.js` validates all environment vars at startup  
✅ **Unified Error Handling** — `error-handler.middleware.js` for consistent error responses  
✅ **Input Validation** — `validation.middleware.js` with schema-based validation  
✅ **Rate Limiting** — `rate-limiter.middleware.js` with per-endpoint configurations  
✅ **Retry Mechanism** — `retry.util.js` with exponential backoff for resilient API calls  
✅ **Dashboard Service** — `dashboard.service.js` with intelligent caching  
✅ **Provider Abstraction** — `shipping/` folder for multi-provider support  

---

## Core Architecture

### 3-Layer Design

```
┌─────────────────────────────────────────┐
│        HTTP Layer (Controllers)         │
│   ├─ Request validation                 │
│   ├─ Error handling                     │
│   └─ Response formatting                │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│    Service Layer (Odoo Integration)     │
│   ├─ Business logic                     │
│   ├─ Odoo RPC calls                     │
│   ├─ Data transformation                │
│   └─ Caching strategies                 │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│    External Systems (Odoo, Shiprocket)  │
│   ├─ Odoo XML-RPC API                   │
│   ├─ Shipping Provider APIs             │
│   └─ External Services                  │
└─────────────────────────────────────────┘
```

### Singleton Pattern for Odoo Auth

```javascript
// OdooClient is created once and reused
const client = await authService.getClient();
// Same client for all subsequent calls in the session
```

Benefits:
- Single authentication per session
- Cached UID and session
- Reduced network overhead
- Managed credentials

---

## Production Features

### 1. Error Handling

**Centralized** (`error-handler.middleware.js`):
```javascript
// All errors route through unified handler
// Safe messages (no credential leaks)
// Proper HTTP status codes
// Structured logging
// Error tracking hooks for Sentry/DataDog
```

**Error Types**:
- `400` — Validation errors
- `401` — Authentication failures
- `403` — Authorization failures
- `404` — Resource not found
- `409` — Conflict/duplicate
- `429` — Rate limit exceeded
- `500` — Server errors
- `503` — Service unavailable

### 2. Input Validation

**Schema-Based** (`validation.middleware.js`):
```javascript
validator.registerSchema("createOrder", {
  customerId: { type: "number", required: true },
  lines: { type: "array", required: true },
  total: { type: "number", min: 0 }
});

// Auto-validates all requests
app.post("/orders", validator.middleware("createOrder"), createOrder);
```

### 3. Rate Limiting

**Per-Endpoint** (`rate-limiter.middleware.js`):
```javascript
{
  dashboard: 60 requests/minute    // High frequency allowed
  retrieve:  30 requests/minute    // Moderate
  create:    10 requests/minute    // Stricter
  delete:     5 requests/minute    // Very strict
  auth:       5 requests/15min     // Account protection
}
```

**Headers Returned**:
- `X-RateLimit-Limit` — Max requests
- `X-RateLimit-Current` — Current count
- `X-RateLimit-Reset` — Reset timestamp

### 4. Retry Mechanism

**Exponential Backoff** (`retry.util.js`):
```javascript
// Automatic retries with smart backoff
Attempt 1: immediate
Attempt 2: 100ms + jitter
Attempt 3: 200ms + jitter
Attempt 4: 400ms + jitter
Max: 5000ms

// Smart error detection
// Only retries transient errors (timeout, connection refused)
// Fails immediately on permanent errors (400, 403, 404)
```

### 5. Intelligent Caching

**Dashboard** (`dashboard.service.js`):
```javascript
// Configurable TTLs per metric
{
  TODAY_SALES:    5 minutes
  MONTHLY_SALES: 30 minutes
  TOP_PRODUCTS:   1 hour
  LOW_STOCK:     15 minutes
  ...
}

// Cache invalidation
dashboardService.invalidateCache(['todaySales', 'pendingOrders']);
```

**Benefits**:
- Reduced Odoo API calls
- Faster response times
- Configurable per metric
- Manual invalidation support

### 6. Environment Management

**Centralized** (`config-manager.js`):
```javascript
// Validates all env vars at startup
// Type checking, required fields, defaults
// Sensitive data redaction in logs
// Clear error messages

ConfigManager validates:
✓ Required fields presence
✓ Type correctness (string, number, etc.)
✓ Enum values
✓ Min/Max ranges
✓ URL format (Odoo URL)
✓ Database credentials
```

### 7. Security

**Best Practices**:
- ✅ No credentials in logs
- ✅ Input sanitization (SQL injection prevention)
- ✅ Rate limiting per IP/user
- ✅ CORS configuration
- ✅ Helmet for security headers
- ✅ Request validation before Odoo calls
- ✅ Circuit breaker for failing services
- ✅ Safe error messages (no stack traces to clients)

### 8. Logging

**Structured Logging**:
```javascript
// Context-aware logging
logError('error', 'fetch_products', {
  method: 'GET',
  statusCode: 500,
  duration: 1234,
  userId: 'user123'
}, error);

// Output includes
{
  timestamp,
  level,
  action,
  method,
  statusCode,
  error: { message, type, stack? }
}
```

---

## API Endpoints

### Dashboard (✨ NEW)

```
GET /api/dashboard/today              Today's sales
GET /api/dashboard/monthly            Monthly sales by week
GET /api/dashboard/top-products       Top 10 products
GET /api/dashboard/low-stock          Products below threshold
GET /api/dashboard/pending-orders     Pending/overdue orders
GET /api/dashboard/revenue            Revenue metrics
GET /api/dashboard/customers          Customer statistics
GET /api/dashboard/profit             Profit & margin
GET /api/dashboard/snapshot           All metrics at once
POST /api/dashboard/invalidate-cache  Clear cache
```

### Products

```
GET /api/odoo/products               List products
GET /api/odoo/products/search        Search products
GET /api/odoo/products/categories    Get categories
GET /api/odoo/products/:id           Get product details
```

### Inventory

```
GET /api/inventory                   All inventory
GET /api/inventory/sku/:sku          By SKU
GET /api/inventory/product/:id       By product ID
GET /api/inventory/warehouse-summary/:id  Warehouse breakdown
```

### Customers

```
POST /api/odoo/customer              Create/sync customer
GET /api/odoo/customer/:id           Get customer
PUT /api/odoo/customer/:id           Update customer
GET /api/odoo/customer/search/by-email/:email
```

### Sales Orders

```
POST /api/odoo/sales                 Create sales order
GET /api/odoo/sales/:id              Get order
POST /api/odoo/sales/:id/confirm     Confirm order
POST /api/odoo/sales/:id/cancel      Cancel order
GET /api/odoo/sales/:id/invoice      Get invoice
```

### Shipping

```
GET /api/shipping                    List shipments
POST /api/shipping                   Create shipment
POST /api/shipping/:id/confirm       Confirm shipment
POST /api/shipping/:id/link-provider Link to provider
GET /api/shipping/:id/tracking       Get tracking info
GET /api/shipping/:id/label          Get shipping label
GET /api/shipping/:id/delivery-estimate
POST /api/shipping/:id/cancel        Cancel shipment
```

### Accounting

```
GET /api/accounting/invoices         List invoices
POST /api/accounting/invoices        Create invoice
GET /api/accounting/invoices/:id     Get invoice
POST /api/accounting/invoices/:id/post
GET /api/accounting/invoices/:id/pdf Download PDF
GET /api/accounting/ledger/:customerId
```

---

## Best Practices

### 1. Always Use withRetry()

```javascript
// ✅ GOOD
const products = await withRetry(
  () => client.call('product.product', 'search', [domain]),
  'Fetch products',
  { maxRetries: 3 }
);

// ❌ BAD
const products = await client.call('product.product', 'search', [domain]);
```

### 2. Validate Input First

```javascript
// ✅ GOOD
const { id } = req.params;
const validated = validateId(id);
const data = await service.getById(validated);

// ❌ BAD
const data = await service.getById(req.params.id);
```

### 3. Use Centralized Error Handling

```javascript
// ✅ GOOD
try {
  const result = await fetchData();
  return res.json({ success: true, data: result });
} catch (err) {
  const appError = normalizeError(err);
  return res.status(appError.statusCode).json(appError.toJSON());
}

// ❌ BAD
try {
  const result = await fetchData();
  res.json(result);
} catch (err) {
  res.status(500).json({ error: err.message });
}
```

### 4. Cache Appropriately

```javascript
// ✅ GOOD: Cache read-heavy operations
const products = _getCache('products') || 
  await fetchFromOdoo();

// ✅ GOOD: Invalidate after write operations
await service.createProduct(data);
_clearCache('products');

// ❌ BAD: Cache everything including user-specific data
```

### 5. Log with Context

```javascript
// ✅ GOOD
logError('error', 'fetch_orders', {
  customerId: id,
  timestamp: new Date().toISOString(),
  duration: endTime - startTime
}, error);

// ❌ BAD
console.error('Error:', error.message);
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set and validated
- [ ] MongoDB connection tested
- [ ] Odoo connection tested (health check endpoint)
- [ ] Shipping provider credentials configured (if using)
- [ ] Rate limits configured appropriately
- [ ] Cache TTLs tuned for production
- [ ] Error tracking service configured (Sentry/DataDog)
- [ ] Logging level set to 'info' or 'warn'
- [ ] CORS origins configured
- [ ] JWT secret configured (if using auth)

### Database

- [ ] MongoDB indexes created for common queries
- [ ] Backup strategy in place
- [ ] Monitoring and alerting enabled

### Odoo Integration

- [ ] Odoo credentials tested
- [ ] API user has sufficient permissions
- [ ] XML-RPC API enabled in Odoo
- [ ] Connection timeout set appropriately
- [ ] Retry configuration tested

### Security

- [ ] HTTPS enabled
- [ ] Helmet middleware enabled
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation active
- [ ] No console logs of sensitive data
- [ ] Security headers set

### Performance

- [ ] Dashboard caching enabled
- [ ] Pagination limits enforced
- [ ] Database indexes verified
- [ ] Connection pooling configured
- [ ] Load testing completed
- [ ] Response times acceptable

### Monitoring

- [ ] Error tracking configured
- [ ] Performance metrics collected
- [ ] Uptime monitoring enabled
- [ ] Alert thresholds set
- [ ] Log aggregation configured

### Post-Deployment

- [ ] Smoke tests run
- [ ] Integration tests passed
- [ ] Dashboard accessible
- [ ] All endpoints responsive
- [ ] No error spikes
- [ ] Performance meets SLAs

---

## Migration Guide (Legacy → Production)

### Step 1: Use New Error Handler

```javascript
// OLD
const { notFound, errorHandler } = require('./middleware/error.middleware');

// NEW
const { notFound, errorHandler } = require('./middleware/error-handler.middleware');
```

### Step 2: Use Config Manager

```javascript
// OLD
const env = require('./config/env');

// NEW
const { env } = require('./config/config-manager');
```

### Step 3: Add Retry Mechanism

```javascript
// OLD
return await client.call('model', 'method', params);

// NEW
const { withRetry } = require('./utils/retry.util');
return await withRetry(
  () => client.call('model', 'method', params),
  'Operation name',
  { maxRetries: 3 }
);
```

### Step 4: Add Input Validation

```javascript
// OLD
if (!id) throw new Error('ID required');

// NEW
const { validateId } = require('./middleware/validation.middleware');
const validatedId = validateId(id);
```

---

## Troubleshooting

### "Rate limit exceeded"

**Solution**: Check `X-RateLimit-Reset` header, wait or increase limits in `rate-limiter.middleware.js`

### "Odoo connection failed"

**Solution**: 
1. Verify ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_PASSWORD in .env
2. Test Odoo is accessible: `curl https://your-odoo-url`
3. Check API user has permissions

### "Cache seems stale"

**Solution**: Manually invalidate: `POST /api/dashboard/invalidate-cache`

### High response times

**Solution**:
1. Check Dashboard service cache TTLs
2. Verify database indexes
3. Enable query logging to identify slow queries
4. Consider increasing Odoo timeout

### Memory usage growing

**Solution**:
1. Check cache cleanup is running
2. Monitor for memory leaks in long-running processes
3. Implement cache size limits

---

## Performance Optimization Tips

### 1. Batch Queries

```javascript
// Fetch multiple records at once instead of N requests
const productIds = [1, 2, 3, 4, 5];
const products = await client.call(
  'product.product',
  'read',
  [productIds, ['name', 'price']]
);
```

### 2. Use Search Domains Efficiently

```javascript
// Good: Specific domain
domain = [['state', '=', 'sale'], ['date_order', '>=', today]];

// Bad: Fetch all then filter
domain = [];
```

### 3. Limit Fields Retrieved

```javascript
// Only fetch needed fields
const fields = ['id', 'name', 'price'];
const products = await client.call('product.product', 'read', [ids, fields]);
```

### 4. Implement Pagination

```javascript
// Always paginate large datasets
const results = await client.call('sale.order', 'search', [domain, {
  limit: 100,
  offset: pageNum * 100,
  order: 'date_order desc'
}]);
```

---

## Future Enhancements

- [ ] Add Redis for distributed caching
- [ ] Implement GraphQL API
- [ ] Add WebSocket for real-time updates
- [ ] Implement webhook system for Odoo events
- [ ] Add advanced analytics (predictions, forecasting)
- [ ] Multi-language support
- [ ] Advanced security (API keys, OAuth2)
- [ ] Data warehouse integration
- [ ] Mobile app backend optimization

---

**Version**: 1.0.0  
**Last Updated**: 2026-06-26  
**Status**: Production Ready  
**Maintained By**: Backend Team
