/**
 * fulfillment.service — unit tests for idempotency and the race-safe
 * browser + webhook ordering guarantee.
 *
 *   npm test -- --testPathPattern=fulfillment
 *
 * Strategy: pure in-process Jest mocks — no live MongoDB, no HTTP.
 * We mock the models and downstream services, then verify the contract:
 *
 *   1. First call to fulfillPaidOrder() creates an Order and returns created=true.
 *   2. Second call with the SAME razorpayOrderId returns the existing order
 *      unchanged (created=false) — idempotency.
 *   3. A Mongoose duplicate-key error (code 11000) on the create() call
 *      is handled gracefully, so a browser + webhook race can never produce
 *      two orders.
 *   4. A missing product causes a descriptive PRODUCT_MISSING error rather
 *      than silently dropping the line item.
 *   5. Inventory reservation failures do NOT roll back the paid order —
 *      the order is retained for manual fulfillment.
 *   6. Finance transaction and email errors do NOT throw — they are
 *      fire-and-forget side effects.
 *   7. fulfillPaidOrder marks the PendingOrder snapshot as fulfilled.
 */

"use strict";

// ─── test doubles ─────────────────────────────────────────────────────────────

const mockOrderFindOne = jest.fn();
const mockOrderCreate  = jest.fn();
const mockOrderSave    = jest.fn();

jest.mock("../src/models/Order", () => {
  const Ctor = jest.fn().mockImplementation((data) => ({ ...data, _id: { toString: () => "order_abc123" }, save: mockOrderSave }));
  Ctor.findOne = mockOrderFindOne;
  Ctor.create  = mockOrderCreate;
  return Ctor;
});

const mockProductFind = jest.fn();
jest.mock("../src/models/Product", () => ({ find: mockProductFind }));

const mockCouponFindOne = jest.fn();
jest.mock("../src/models/Coupon", () => ({ findOne: mockCouponFindOne }));

const mockFinanceCreate = jest.fn().mockResolvedValue({});
const mockFinanceCount  = jest.fn().mockResolvedValue(0);
jest.mock("../src/models/FinanceTransaction", () => ({
  create: mockFinanceCreate,
  countDocuments: mockFinanceCount,
}));

const mockCustomerProfile = jest.fn().mockResolvedValue(null);
jest.mock("../src/models/CustomerProfile", () => ({ findOne: mockCustomerProfile }));

const mockPendingOrderUpdateOne = jest.fn().mockResolvedValue({});
jest.mock("../src/models/PendingOrder", () => ({
  updateOne: mockPendingOrderUpdateOne,
}));

const mockReserve = jest.fn().mockResolvedValue({});
jest.mock("../src/services/inventory.service", () => ({ reserveForOrder: mockReserve }));

const mockSendInvoice = jest.fn().mockResolvedValue({});
const mockSendAdmin   = jest.fn().mockResolvedValue({});
jest.mock("../src/services/mail.service", () => ({
  sendOrderInvoiceEmail:        mockSendInvoice,
  sendAdminOrderNotificationEmail: mockSendAdmin,
}));

// ─── helpers ──────────────────────────────────────────────────────────────────

const MOCK_AUTH = { sub: "user_001", email: "customer@example.com", role: "customer" };
const MOCK_ITEMS = [{ productId: "prod_001", quantity: 2, variantSku: "" }];

function makeProduct(overrides = {}) {
  return {
    _id: { toString: () => "prod_001" },
    name: "Test Thread",
    image: "https://res.cloudinary.com/test/image/upload/v1/thread.jpg",
    price: 250,
    stock: 10,
    dealerId: "dealer_001",
    dealerName: "Test Dealer",
    dealerEmail: "dealer@example.com",
    variants: [],
    ...overrides,
  };
}

function makePersistedOrder(overrides = {}) {
  return {
    _id: { toString: () => "order_abc123" },
    userId: MOCK_AUTH.sub,
    userEmail: MOCK_AUTH.email,
    userRole: "customer",
    items: [{
      productId: { toString: () => "prod_001" },
      dealerId: "dealer_001",
      dealerName: "Test Dealer",
      dealerEmail: "dealer@example.com",
      name: "Test Thread",
      image: "https://res.cloudinary.com/test/image/upload/v1/thread.jpg",
      price: 250,
      quantity: 2,
      variantSku: "",
      variant: undefined,
      customization: undefined,
    }],
    subtotal: 500,
    shipping: 49,
    discount: 0,
    coupon: null,
    tax: 0,
    total: 549,
    status: "Processing",
    paymentMethod: "upi",
    paymentStatus: "paid",
    razorpayPaymentId: "pay_test_001",
    razorpayOrderId: "order_rz_001",
    deliveryPrepaid: false,
    amountPrepaid: 549,
    amountDueOnDelivery: 0,
    createdAt: new Date().toISOString(),
    save: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("fulfillPaidOrder", () => {
  let fulfillPaidOrder;

  beforeAll(() => {
    // Resolve after all mocks are registered
    ({ fulfillPaidOrder } = require("../src/services/fulfillment.service"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCouponFindOne.mockResolvedValue(null);
  });

  // ── 1. Happy path ───────────────────────────────────────────────────────────
  describe("happy path — first call creates order", () => {
    beforeEach(() => {
      mockOrderFindOne.mockResolvedValue(null);               // no existing order
      mockProductFind.mockResolvedValue([makeProduct()]);
      const created = makePersistedOrder();
      mockOrderCreate.mockResolvedValue(created);
    });

    it("returns created=true on first call", async () => {
      const result = await fulfillPaidOrder({
        auth: MOCK_AUTH,
        items: MOCK_ITEMS,
        razorpayOrderId: "order_rz_001",
        razorpayPaymentId: "pay_test_001",
        source: "test",
      });
      expect(result.created).toBe(true);
      expect(result.order.id).toBe("order_abc123");
    });

    it("calls Order.create exactly once", async () => {
      await fulfillPaidOrder({
        auth: MOCK_AUTH,
        items: MOCK_ITEMS,
        razorpayOrderId: "order_rz_001",
        razorpayPaymentId: "pay_test_001",
        source: "test",
      });
      expect(mockOrderCreate).toHaveBeenCalledTimes(1);
    });

    it("marks the PendingOrder snapshot as fulfilled", async () => {
      await fulfillPaidOrder({
        auth: MOCK_AUTH,
        items: MOCK_ITEMS,
        razorpayOrderId: "order_rz_001",
        razorpayPaymentId: "pay_test_001",
        source: "test",
      });
      expect(mockPendingOrderUpdateOne).toHaveBeenCalledWith(
        { razorpayOrderId: "order_rz_001" },
        expect.objectContaining({ $set: expect.objectContaining({ status: "fulfilled" }) })
      );
    });

    it("calls inventory reservation once", async () => {
      await fulfillPaidOrder({
        auth: MOCK_AUTH,
        items: MOCK_ITEMS,
        razorpayOrderId: "order_rz_001",
        razorpayPaymentId: "pay_test_001",
        source: "test",
      });
      expect(mockReserve).toHaveBeenCalledTimes(1);
    });
  });

  // ── 2. Idempotency — existing order returned unchanged ──────────────────────
  describe("idempotency — same razorpayOrderId called twice", () => {
    it("returns created=false when order already exists", async () => {
      const existing = makePersistedOrder();
      // First call: no existing order
      mockOrderFindOne.mockResolvedValueOnce(null);
      mockProductFind.mockResolvedValue([makeProduct()]);
      mockOrderCreate.mockResolvedValue(existing);
      await fulfillPaidOrder({
        auth: MOCK_AUTH,
        items: MOCK_ITEMS,
        razorpayOrderId: "order_rz_001",
        razorpayPaymentId: "pay_test_001",
        source: "browser",
      });

      // Second call: now the order exists
      mockOrderFindOne.mockResolvedValueOnce(existing);
      const result = await fulfillPaidOrder({
        auth: MOCK_AUTH,
        items: MOCK_ITEMS,
        razorpayOrderId: "order_rz_001",
        razorpayPaymentId: "pay_test_001",
        source: "webhook",
      });

      expect(result.created).toBe(false);
      expect(mockOrderCreate).toHaveBeenCalledTimes(1); // only on first call
    });

    it("does NOT send a second invoice email when order already exists", async () => {
      const existing = makePersistedOrder();
      mockOrderFindOne.mockResolvedValue(existing);

      await fulfillPaidOrder({
        auth: MOCK_AUTH,
        items: MOCK_ITEMS,
        razorpayOrderId: "order_rz_001",
        razorpayPaymentId: "pay_test_001",
        source: "webhook",
      });

      // Invoice email is fire-and-forget in the create branch; since we hit the
      // idempotency guard, Order.create is never called, so no email fires.
      expect(mockSendInvoice).not.toHaveBeenCalled();
    });
  });

  // ── 3. Race condition: duplicate-key error (browser + webhook concurrency) ──
  describe("concurrent race — duplicate-key handled gracefully", () => {
    it("returns the winning order when Order.create raises 11000", async () => {
      const winner = makePersistedOrder();
      mockOrderFindOne
        .mockResolvedValueOnce(null)   // no order before create()
        .mockResolvedValueOnce(winner); // winner found after the dup-key
      mockProductFind.mockResolvedValue([makeProduct()]);

      const dupKeyErr = new Error("Duplicate key");
      dupKeyErr.code = 11000;
      mockOrderCreate.mockRejectedValue(dupKeyErr);

      const result = await fulfillPaidOrder({
        auth: MOCK_AUTH,
        items: MOCK_ITEMS,
        razorpayOrderId: "order_rz_001",
        razorpayPaymentId: "pay_test_001",
        source: "webhook",
      });

      expect(result.created).toBe(false);
      expect(result.order.id).toBe("order_abc123");
    });
  });

  // ── 4. Missing product ──────────────────────────────────────────────────────
  describe("missing product — PRODUCT_MISSING error", () => {
    it("throws PRODUCT_MISSING when a product no longer exists", async () => {
      mockOrderFindOne.mockResolvedValue(null);
      mockProductFind.mockResolvedValue([]); // empty — product deleted

      await expect(
        fulfillPaidOrder({
          auth: MOCK_AUTH,
          items: MOCK_ITEMS,
          razorpayOrderId: "order_rz_002",
          razorpayPaymentId: "pay_test_002",
          source: "test",
        })
      ).rejects.toMatchObject({ code: "PRODUCT_MISSING" });
    });
  });

  // ── 5. Inventory failure doesn't roll back a paid order ─────────────────────
  describe("inventory failure — paid order is retained", () => {
    it("still returns the created order when reservation throws", async () => {
      mockOrderFindOne.mockResolvedValue(null);
      mockProductFind.mockResolvedValue([makeProduct()]);
      const created = makePersistedOrder();
      mockOrderCreate.mockResolvedValue(created);
      mockReserve.mockRejectedValue(new Error("Out of stock in warehouse"));

      const result = await fulfillPaidOrder({
        auth: MOCK_AUTH,
        items: MOCK_ITEMS,
        razorpayOrderId: "order_rz_003",
        razorpayPaymentId: "pay_test_003",
        source: "test",
      });

      expect(result.created).toBe(true);
      expect(result.order.id).toBe("order_abc123");
    });
  });

  // ── 6. Email / finance failures don't surface ───────────────────────────────
  describe("side-effect errors don't propagate", () => {
    it("resolves successfully even when email and finance both throw", async () => {
      mockOrderFindOne.mockResolvedValue(null);
      mockProductFind.mockResolvedValue([makeProduct()]);
      mockOrderCreate.mockResolvedValue(makePersistedOrder());
      mockSendInvoice.mockRejectedValue(new Error("SMTP down"));
      mockSendAdmin.mockRejectedValue(new Error("SMTP down"));
      mockFinanceCreate.mockRejectedValue(new Error("DB timeout"));

      await expect(
        fulfillPaidOrder({
          auth: MOCK_AUTH,
          items: MOCK_ITEMS,
          razorpayOrderId: "order_rz_004",
          razorpayPaymentId: "pay_test_004",
          source: "test",
        })
      ).resolves.toMatchObject({ created: true });
    });
  });

  // ── 7. Input validation ─────────────────────────────────────────────────────
  describe("input validation", () => {
    it("throws when razorpayOrderId is missing", async () => {
      await expect(
        fulfillPaidOrder({ auth: MOCK_AUTH, items: MOCK_ITEMS, razorpayPaymentId: "pay_x" })
      ).rejects.toThrow("razorpayOrderId is required");
    });

    it("throws when auth.sub or auth.email are missing", async () => {
      await expect(
        fulfillPaidOrder({ auth: { sub: "", email: "" }, items: MOCK_ITEMS, razorpayOrderId: "order_y", razorpayPaymentId: "pay_y" })
      ).rejects.toThrow("Buyer identity");
    });

    it("throws when items is empty", async () => {
      mockOrderFindOne.mockResolvedValue(null); // no existing order
      await expect(
        fulfillPaidOrder({ auth: MOCK_AUTH, items: [], razorpayOrderId: "order_z", razorpayPaymentId: "pay_z" })
      ).rejects.toThrow("no items");
    });
  });
});
