# Odoo Shipping Module - Architecture & Documentation

Production-ready modular shipping integration with support for multiple providers (Shiprocket, DHL, FedEx, etc.)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     HTTP Endpoints                           │
│              /api/shipping (Controller Layer)                │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Odoo Shipping Service Layer                     │
│   ├─ getShipments()                                          │
│   ├─ getShipmentById()                                       │
│   ├─ createShipment()                                        │
│   ├─ confirmShipment()                                       │
│   ├─ linkProvider()                                          │
│   ├─ getTrackingInfo()                                       │
│   ├─ getCourierStatus()                                      │
│   ├─ getShippingLabel()                                      │
│   ├─ getExpectedDelivery()                                   │
│   └─ cancelShipment()                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼──────┐          ┌─────▼──────────┐
    │ Odoo RPC  │          │ Provider       │
    │ (Odoo)    │          │ Manager/       │
    └───────────┘          │ Factory        │
                           └─────┬──────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
            ┌────▼────┐     ┌────▼────┐    ┌────▼────┐
            │Shiprocket│     │   DHL   │    │  FedEx  │
            │Provider  │     │Provider │    │Provider │
            └──────────┘     └─────────┘    └─────────┘
```

## Core Layers

### 1. **HTTP Layer** (`src/controllers/odoo-shipping.controller.js`)
- Handles HTTP requests/responses
- Validates input parameters
- Maps to service functions
- Returns appropriate HTTP status codes

### 2. **Service Layer** (`src/services/odoo/shipping.service.js`)
- Core business logic
- Manages Odoo stock.picking (shipments)
- Orchestrates provider calls
- Handles data transformation

### 3. **Provider Layer** (`src/services/shipping/`)
- Abstract interface: `base.provider.js`
- Concrete implementations: `shiprocket.provider.js`, `dhl.provider.js`, etc.
- Provider factory: `index.js`
- Extensible design for easy provider addition

## Available Endpoints

### Shipment Management

```
GET /api/shipping
  List all shipments with filtering
  Query params: offset, limit, customerId, state, origin, search, provider, trackingNumber
  Response: 200 {shipments, total, offset, limit, hasMore}

POST /api/shipping
  Create shipment from sales order
  Body: {salesOrderId}
  Response: 201 {shipment}

GET /api/shipping/:id
  Get shipment details
  Response: 200 {shipment}

POST /api/shipping/:id/confirm
  Confirm shipment (prepare for shipping)
  Response: 200 {shipment}

POST /api/shipping/:id/cancel
  Cancel shipment
  Response: 200 {shipment}
```

### Provider Integration

```
POST /api/shipping/:id/link-provider
  Link shipment to shipping provider and save tracking number
  Body: {provider, trackingNumber}
  Response: 200 {shipment}

GET /api/shipping/:id/tracking?provider=shiprocket
  Get tracking information from provider
  Query: provider (optional, defaults to shipment's provider)
  Response: 200 {shipmentId, trackingNumber, provider, status, currentLocation, lastUpdate, events}

GET /api/shipping/:id/courier-status?provider=shiprocket
  Get courier/carrier status
  Query: provider (optional)
  Response: 200 {shipmentId, courier, status, lastMile, estimatedDelivery}

GET /api/shipping/:id/label?provider=shiprocket&format=json
  Get shipping label
  Query: provider (optional), format (json|pdf)
  Response: 200 {shipmentId, labelUrl, labelPdf, labelBase64, format}

GET /api/shipping/:id/delivery-estimate?provider=shiprocket
  Get expected delivery date
  Query: provider (optional)
  Response: 200 {shipmentId, estimatedDeliveryDate, minDays, maxDays, shippingMode}
```

## Shipment Lifecycle

```
Draft
  ↓
Confirmed (POST /shipping/:id/confirm)
  ↓
Assigned (stock reserved)
  ↓
Link Provider (POST /shipping/:id/link-provider)
  ↓
Tracking Available (GET /shipping/:id/tracking)
  ↓
Done (shipment picked up by courier)
  
Cancellation: draft, confirmed, or assigned → cancelled
```

## Shipment Data Structure

```javascript
{
  id: 123,
  name: "DO/2026/001",
  origin: "SO/2026/001",                    // Link to sales order
  pickingType: "outgoing",
  partnerName: "Customer Name",
  customerId: 456,
  state: "confirmed",                       // draft, confirmed, assigned, done, cancel
  scheduledDate: "2026-06-27T00:00:00Z",
  date: "2026-06-26T12:30:00Z",
  address: {
    street: "123 Street",
    city: "City",
    state: "State",
    zip: "12345",
    country: "India"
  },
  lineItems: [...],                         // Products in shipment
  weight: 2.5,                              // kg
  shippingProvider: "shiprocket",           // Provider name after linking
  trackingNumber: "SR123456789",            // Tracking number after linking
  courierName: "FedEx",                     // Courier name
  expectedDeliveryDate: "2026-07-02T00:00:00Z"
}
```

## Adding New Shipping Providers

### Step 1: Create Provider Class

```javascript
// src/services/shipping/newprovider.provider.js

const BaseShippingProvider = require("./base.provider");

class NewProviderProvider extends BaseShippingProvider {
  constructor(config = {}) {
    super(config);
    this.apiKey = config.apiKey || process.env.NEWPROVIDER_API_KEY;
    this.baseUrl = config.baseUrl || "https://api.newprovider.com";
  }

  async createShipment(shipmentData) {
    // Implement shipment creation
  }

  async getTracking(trackingNumber) {
    // Implement tracking
  }

  async getCourierStatus(trackingNumber) {
    // Implement courier status
  }

  async generateLabel(trackingNumber) {
    // Implement label generation
  }

  async getDeliveryEstimate(trackingNumber) {
    // Implement delivery estimate
  }

  async validateCredentials() {
    // Implement credential validation
  }
}

module.exports = NewProviderProvider;
```

### Step 2: Register Provider

```javascript
// src/services/shipping/index.js

const NewProviderProvider = require("./newprovider.provider");

// Add to providers object
ShippingProviderManager.providers.newprovider = NewProviderProvider;

// Or use registration method
ShippingProviderManager.registerProvider("newprovider", NewProviderProvider);
```

### Step 3: Use Provider

```javascript
const ShippingProviderManager = require("./shipping");

// Get provider instance
const provider = ShippingProviderManager.getProvider("newprovider", {
  apiKey: "your-api-key"
});

// Use provider methods
const shipment = await provider.createShipment(shipmentData);
const tracking = await provider.getTracking(trackingNumber);
```

## Implementing Shiprocket Integration

When ready to implement Shiprocket:

### 1. Get Shiprocket Credentials
```
API Key: From Shiprocket Account Settings
Email: Shiprocket account email
Password: Shiprocket account password
```

### 2. Update Environment Variables
```bash
SHIPPING_PROVIDER=shiprocket
SHIPROCKET_API_KEY=your_api_key
SHIPROCKET_EMAIL=your_email
SHIPROCKET_PASSWORD=your_password
```

### 3. Implement Provider Methods

Replace stub functions in `src/services/shipping/shiprocket.provider.js`:

- `_authenticate()` - OAuth/token authentication
- `createShipment()` - Call Shiprocket API to create shipment
- `getTracking()` - Query tracking status
- `getCourierStatus()` - Get current courier info
- `generateLabel()` - Generate and fetch label PDF
- `getDeliveryEstimate()` - Calculate delivery estimate
- `validateCredentials()` - Test API connection
- `cancelShipment()` - Cancel shipment if supported

### 4. Shiprocket API Endpoints Reference

```
Auth:
POST /auth/login

Create Order:
POST /orders/create/

Get Tracking:
GET /orders/track/

Generate Label:
POST /orders/print/

Cancel Order:
POST /orders/cancel/
```

See: https://apidocs.shiprocket.in/

## Error Handling

All endpoints return standard error responses:

```javascript
// 400 Bad Request - Missing required fields
{
  "success": false,
  "error": "Sales order ID is required"
}

// 404 Not Found - Resource doesn't exist
{
  "success": false,
  "error": "Shipment not found"
}

// 409 Conflict - Invalid state transition
{
  "success": false,
  "error": "Shipment cannot be confirmed. Current state: done"
}

// 500 Internal Server Error
{
  "success": false,
  "error": "Failed to fetch shipments"
}
```

## Testing Workflow

```bash
# 1. Create sales order
curl -X POST http://localhost:5000/api/odoo/sales \
  -H "Content-Type: application/json" \
  -d '{"customerId": 1, "lines": [...], "total": 1000}'

# 2. Create shipment from order
curl -X POST http://localhost:5000/api/shipping \
  -H "Content-Type: application/json" \
  -d '{"salesOrderId": 1}'

# 3. Confirm shipment
curl -X POST http://localhost:5000/api/shipping/1/confirm

# 4. Link provider
curl -X POST http://localhost:5000/api/shipping/1/link-provider \
  -H "Content-Type: application/json" \
  -d '{"provider": "shiprocket", "trackingNumber": "SR123456789"}'

# 5. Get tracking info
curl http://localhost:5000/api/shipping/1/tracking

# 6. Get label
curl http://localhost:5000/api/shipping/1/label?format=json
```

## Configuration

### Environment Variables

```bash
# Shipping provider (default: shiprocket)
SHIPPING_PROVIDER=shiprocket

# Shiprocket credentials
SHIPROCKET_API_KEY=your_api_key
SHIPROCKET_EMAIL=your_email
SHIPROCKET_PASSWORD=your_password

# Future provider configs
# DHL_API_KEY=...
# FEDEX_API_KEY=...
```

### Modular Design Benefits

✅ **Easy Provider Switching** - Change provider with env variable  
✅ **Multiple Providers** - Use different providers for different routes  
✅ **Extensible** - Add new providers without modifying existing code  
✅ **Production-Ready** - Error handling, validation, logging  
✅ **Future-Proof** - Ready for Shiprocket and other integrations  
✅ **Maintainable** - Clear separation of concerns  
✅ **Testable** - Easy to mock providers for testing  

## Status Codes

```
200 OK - Successful operation
201 Created - Shipment created
400 Bad Request - Validation error
404 Not Found - Resource not found
409 Conflict - Invalid state transition
500 Internal Server Error - Server error
503 Service Unavailable - Provider not available
```

## Notes

- All shipment data syncs in real-time with Odoo stock.picking
- Tracking numbers stored in Odoo for persistence
- Providers are stateless and can be easily extended
- Future providers can override default behavior
- Base provider defines interface contract for all implementations
