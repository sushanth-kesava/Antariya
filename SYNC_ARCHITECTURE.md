# Bidirectional Synchronization & Queue Architecture

**Complete Implementation Guide**

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Webhook System](#webhook-system)
3. [Queue System](#queue-system)
4. [Cache Layer](#cache-layer)
5. [Admin APIs](#admin-apis)
6. [Reporting APIs](#reporting-apis)
7. [Deployment Guide](#deployment-guide)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Architecture Overview

### Complete Data Flow

```
ODOO Instance
    │
    ├─→ Webhook Event (Real-time)
    │   └─→ Backend Webhook Receiver
    │       └─→ Duplicate Check (Idempotency)
    │           └─→ Queue Job
    │               └─→ Worker Process
    │                   ├─→ Sync to MongoDB
    │                   ├─→ Invalidate Cache
    │                   └─→ Log Sync Event
    │
    └─→ Scheduled Sync (Fallback)
        └─→ Cron Job (every 5 min)
            └─→ Query Changes
                └─→ Queue Batch Jobs
                    └─→ Workers Process

Frontend
    │
    └─→ REST API
        └─→ Cache-First Architecture
            ├─→ Check Redis Cache
            ├─→ If Miss: Query Backend
            ├─→ If Miss: Query Odoo
            └─→ Return Cached Result

Admin Dashboard
    │
    └─→ Dashboard APIs
        └─→ Real-time Metrics
            ├─→ Revenue
            ├─→ Orders
            ├─→ Inventory
            └─→ Customers
```

### System Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Webhook Receiver** | Real-time event ingestion | Express + HMAC verification |
| **Queue System** | Job processing | BullMQ + Redis |
| **Workers** | Async job execution | Node.js Workers |
| **Cache Layer** | Performance optimization | Redis |
| **Admin APIs** | Dashboard metrics | Express + Odoo queries |
| **Reporting** | Analytics & export | CSV/Excel/PDF |

---

## Webhook System

### 1. Webhook Configuration in Odoo

**Setup Steps:**

1. In Odoo Admin, go to **Settings → Integrations → Webhooks**
2. Create webhook for each event:

```javascript
{
  "name": "Antariya Product Sync",
  "event": "product.product.create|product.product.update|product.product.delete",
  "url": "https://api.antariya.fashion/api/webhooks/odoo",
  "subscribe_to": "product.product",
  "actions": ["create", "update", "delete"]
}
```

**For All Event Types:**

```
product.product.create        → /api/webhooks/odoo
product.product.update        → /api/webhooks/odoo
product.product.delete        → /api/webhooks/odoo
stock.quant.update            → /api/webhooks/odoo
sale.order.create             → /api/webhooks/odoo
sale.order.confirm            → /api/webhooks/odoo
sale.order.shipped            → /api/webhooks/odoo
sale.order.delivered          → /api/webhooks/odoo
sale.order.cancel             → /api/webhooks/odoo
account.move.create           → /api/webhooks/odoo
account.move.posted           → /api/webhooks/odoo
account.move.paid             → /api/webhooks/odoo
account.move.cancelled        → /api/webhooks/odoo
```

### 2. Webhook Receiver Flow

```javascript
// File: backend/src/controllers/webhook.controller.js

router.post("/api/webhooks/odoo", async (req, res) => {
  // 1. Verify HMAC signature
  const valid = verifyWebhookSignature(req.body, req.headers['x-odoo-signature']);
  if (!valid) return res.status(401).json({ error: "Invalid signature" });

  // 2. Check for duplicate (idempotency)
  const existing = await SyncEvent.findOne({ odooEventId: req.body.id });
  if (existing) return res.json({ success: true, isDuplicate: true });

  // 3. Create sync event record
  const syncEvent = await SyncEvent.create({
    odooEventId: req.body.id,
    eventType: req.body.event,
    payload: req.body.data,
    status: "pending"
  });

  // 4. Queue job based on event
  const jobId = await queueSyncJob(req.body.event, req.body.data, syncEvent._id);

  // 5. Return confirmation
  res.json({ success: true, eventId: syncEvent._id, jobId });
});
```

### 3. Idempotency Guarantee

**Problem**: Same webhook may arrive multiple times

**Solution**: 

```javascript
// Check by Odoo event ID (unique)
const existing = await SyncEvent.findOne({ 
  odooEventId: payload.id  // Odoo's unique event ID
});

if (existing) {
  logError('warn', 'duplicate_webhook', {
    odooEventId: payload.id,
    previousStatus: existing.status
  });
  return { success: true, isDuplicate: true };
}
```

**Result**: Same webhook processed only once, even if received 100 times

---

## Queue System

### 1. BullMQ Configuration

**File**: `backend/src/services/queue/queue.config.js`

```javascript
const Queue = require("bullmq");
const { Redis } = require("ioredis");

const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
});

// Create queues with different priorities
const syncQueue = new Queue("odoo-sync", { connection: redisClient });
const inventoryQueue = new Queue("inventory-sync", { connection: redisClient });
const orderQueue = new Queue("order-sync", { connection: redisClient });
// ... more queues
```

### 2. Job Types & Priority

| Queue | Priority | Retries | Use Case |
|-------|----------|---------|----------|
| **inventory-sync** | 20 (highest) | 5 | Critical inventory updates |
| **order-sync** | 15 | 4 | Order status changes |
| **product-sync** | 10 | 3 | Product catalog |
| **invoice-sync** | 12 | 3 | Invoice processing |
| **email-send** | 5 | 3 | Notifications |
| **media-sync** | 8 | 3 | Product images |
| **report-generate** | 3 | 2 | Analytics |

### 3. Worker Implementation

**File**: `backend/src/services/workers/product.sync.worker.js`

```javascript
const { Worker } = require("bullmq");

const productSyncWorker = new Worker(
  "odoo-sync",
  async (job) => {
    if (job.data.action === "product-sync") {
      // 1. Fetch product from Odoo
      const product = await fetchOdooProduct(job.data.productId);

      // 2. Update or create in MongoDB
      await upsertProduct(product);

      // 3. Invalidate cache
      await invalidateCache(`product:${job.data.productId}`);

      // 4. Update sync event
      await SyncEvent.updateOne(
        { _id: job.data.syncEventId },
        { status: "completed", processedAt: new Date() }
      );

      return { success: true };
    }
  },
  {
    connection: redisClient,
    concurrency: 5,  // Process 5 jobs concurrently
  }
);

productSyncWorker.on("completed", (job) => {
  logError("info", "job_completed", { jobId: job.id });
});

productSyncWorker.on("failed", (job, error) => {
  logError("error", "job_failed", { jobId: job.id }, error);
  // Move to Dead Letter Queue after max retries
});
```

### 4. Retry Policy

**Exponential Backoff:**

```javascript
{
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2000  // Start at 2 seconds
  }
}

// Retry schedule:
// Attempt 1: Immediate
// Attempt 2: 2 seconds + jitter
// Attempt 3: 4 seconds + jitter
// Fail: Move to DLQ if all retries exhausted
```

---

## Scheduled Synchronization (Fallback)

### Problem
Webhooks may fail or be missed

### Solution
Scheduled sync queries Odoo for changes every 5 minutes

### Implementation

```javascript
// File: backend/src/services/sync/webhook.processor.js

async function scheduledSync(entityType) {
  // 1. Get last sync time
  const lastSync = await getLastSyncTime(entityType);
  
  // 2. Query Odoo for changes since last sync
  const changes = await client.call(
    getModel(entityType),
    'search_read',
    [
      [['write_date', '>=', lastSync || 5.minutes.ago]]
    ]
  );

  // 3. Queue jobs for each change
  for (const change of changes) {
    await queueSyncJob(change);
  }

  // 4. Update last sync time
  await updateLastSyncTime(entityType);

  return { synced: changes.length, failed: 0 };
}
```

**Cron Configuration:**

```bash
# Run scheduled sync every 5 minutes
0 */5 * * * * backend/scripts/sync-cron.js

# Or use BullMQ repeatable jobs
const job = await syncQueue.add(
  'scheduled-sync',
  { entityType: 'products' },
  {
    repeat: {
      cron: '*/5 * * * *'  // Every 5 minutes
    }
  }
);
```

---

## Cache Layer

### 1. Cache Configuration

**File**: `backend/src/services/cache/cache.manager.js`

```javascript
const CACHE_CONFIG = {
  // Products (1 hour)
  product: {
    ttl: 3600,
    key: (id) => `product:${id}`
  },
  
  // Inventory (5 minutes - critical)
  inventory: {
    ttl: 300,
    key: (productId) => `inventory:${productId}`
  },
  
  // Dashboard (5-30 minutes)
  dashboard_today: {
    ttl: 300,
    key: () => "dashboard:today"
  },
  dashboard_revenue: {
    ttl: 1800,
    key: () => "dashboard:revenue"
  }
};
```

### 2. Cache-First Pattern

```javascript
// Get or fetch with callback
async function getProductsList() {
  return await getOrFetch(
    'products:list',
    async () => {
      // This only runs if not in cache
      return await fetchProductsFromOdoo();
    },
    1800  // 30 minute TTL
  );
}
```

### 3. Cache Invalidation

**On Product Change:**
```javascript
await invalidateProductCache(productId);
// Clears:
// - product:${productId}
// - products:list
// - categories
// - dashboard:*
```

**Automatic Invalidation:**
```javascript
// In worker after sync completes
await invalidateCache(`product:${productId}`);
await invalidateCache('products:list');
await invalidateCachePattern('dashboard:*');
```

---

## Admin APIs

### 1. Dashboard Endpoints

**Base URL**: `/api/admin/dashboard`

```javascript
// Revenue today
GET /revenue/today
Response: {
  totalAmount: 125000,
  orderCount: 45,
  breakdown: { confirmed: 40, completed: 5 }
}

// Revenue weekly
GET /revenue/weekly?days=7
Response: {
  totalAmount: 875000,
  daily: [
    { date: "2025-06-26", amount: 125000, count: 45 }
  ]
}

// Orders today
GET /orders/today
Response: {
  total: 45,
  orders: [
    { id: 1, number: "SO-001", status: "confirmed", amount: 5000 }
  ]
}

// Low stock products
GET /inventory/low-stock?threshold=10
Response: {
  total: 23,
  products: [
    { id: 1, name: "T-Shirt", sku: "TS-001", quantity: 5, price: 499 }
  ]
}

// Best selling products
GET /products/best-selling?limit=10
Response: {
  total: 10,
  products: [
    { id: 1, name: "T-Shirt", quantity: 500, revenue: 250000 }
  ]
}

// All metrics at once
GET /snapshot
Response: {
  todayRevenue: { ... },
  weeklyRevenue: { ... },
  ordersToday: { ... },
  pendingOrders: { ... },
  lowStock: { ... },
  inventoryValue: { ... },
  bestSellers: { ... },
  customers: { ... }
}
```

---

## Reporting APIs

### 1. Report Generation with Export

**Base URL**: `/api/admin/reports`

```javascript
// Revenue report with export
POST /revenue
Body: {
  fromDate: "2025-06-01",
  toDate: "2025-06-30",
  format: "json|csv|excel|pdf"
}
Response: File download or JSON

// Profit report
POST /profit
Body: {
  fromDate: "2025-06-01",
  toDate: "2025-06-30",
  format: "excel"
}

// Inventory report
GET /inventory?format=csv

// Customer report
GET /customers?format=pdf
```

### 2. Export Formats

**CSV**
```csv
orderId,amount,status,date
1,5000,confirmed,2025-06-26
2,3500,completed,2025-06-26
```

**Excel**
- Formatted with headers
- Colored cells
- Professional styling

**PDF**
- Title, date range
- Summary statistics
- Itemized details

---

## Deployment Guide

### 1. Environment Variables

```bash
# .env
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_PASSWORD=your-password

ODOO_WEBHOOK_SECRET=your-webhook-secret
ODOO_URL=https://odoo.antariya.com
ODOO_DB=production
ODOO_USERNAME=api_user
ODOO_PASSWORD=secure-password

# Queue concurrency
QUEUE_CONCURRENCY=5
```

### 2. Dependencies

```bash
npm install bullmq ioredis json2csv exceljs pdfkit
```

### 3. Server Integration

```javascript
// In backend/src/server.js

const webhookRoutes = require("./routes/webhook.routes");
const adminDashboardRoutes = require("./routes/admin-dashboard.routes");
const adminReportingRoutes = require("./routes/admin-reporting.routes");

app.use("/api/webhooks", webhookRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/reports", adminReportingRoutes);

// Start workers
require("./services/workers/product.sync.worker");
require("./services/workers/inventory.sync.worker");
require("./services/workers/order.sync.worker");
// ... other workers
```

### 4. Database Indexes

```javascript
// Sync events
db.syncevent.createIndex({ odooEventId: 1 }, { unique: true });
db.syncevent.createIndex({ status: 1, createdAt: -1 });

// Sync logs
db.synclog.createIndex({ entityType: 1, syncTime: -1 });
```

---

## Monitoring & Troubleshooting

### 1. Queue Health Check

```javascript
GET /api/admin/queue/health
Response: {
  sync: { active: 5, waiting: 12, completed: 1000, failed: 3 },
  inventory: { active: 2, waiting: 8, completed: 500, failed: 1 },
  order: { active: 3, waiting: 15, completed: 200, failed: 2 }
}
```

### 2. Cache Statistics

```javascript
GET /api/admin/cache/stats
Response: {
  dbSize: 1024,
  memory: "256MB",
  hitRate: "92%",
  keys: 5000
}
```

### 3. Sync Event Logs

```javascript
GET /api/admin/sync/events?status=failed&limit=10
Response: [
  {
    _id: "uuid",
    eventType: "product.product.update",
    status: "failed",
    lastError: "Connection timeout",
    retryCount: 3
  }
]
```

### 4. Debugging Failed Jobs

```javascript
// Get job details
const job = await syncQueue.getJob(jobId);
console.log(job.data);      // Input data
console.log(job.failedReason); // Error reason
console.log(job.attemptsMade); // Retry count

// Retry failed job
await job.retry();

// Move to another queue
await job.moveToFailed(new Error("Manual failure"), true);
```

---

## Example: Product Sync Flow

### Step-by-Step

1. **Odoo Updates Product**
   - User changes price to 999 in Odoo
   - Odoo fires `product.product.update` webhook

2. **Backend Receives Webhook**
   - Webhook receiver gets POST to `/api/webhooks/odoo`
   - Verifies HMAC signature
   - Checks for duplicate (idempotency key)
   - Creates SyncEvent record (status: pending)

3. **Job Queued**
   - Queues job: `{ type: 'sync-product', productId: 123, syncEventId: 'uuid' }`
   - Job added to priority queue (priority: 10)

4. **Worker Processes**
   - Worker picks up job from queue
   - Fetches product 123 from Odoo
   - Updates MongoDB Product document
   - Invalidates cache: `product:123`, `products:list`, `dashboard:*`
   - Updates SyncEvent (status: completed)
   - Job marked as completed

5. **Results**
   - Frontend gets product from cache (updated)
   - API returns fresh price 999
   - Dashboard metrics invalidated (will refresh)
   - Full audit trail in SyncEvent

**Total Time**: ~500ms (fetch) + processing

---

## Key Features Implemented

✅ **Webhook-based real-time sync**
✅ **Scheduled fallback sync every 5 minutes**
✅ **Duplicate prevention (idempotency)**
✅ **Priority-based job queue (BullMQ)**
✅ **Exponential backoff retries**
✅ **Dead letter queue for failed jobs**
✅ **Redis caching with TTL**
✅ **Automatic cache invalidation**
✅ **Admin dashboard APIs**
✅ **Reporting with CSV/Excel/PDF export**
✅ **Comprehensive logging**
✅ **Health checks & monitoring**

---

**This implementation provides a production-grade synchronization system that ensures data consistency between Odoo and the backend while maintaining high performance through caching and parallel processing.**
