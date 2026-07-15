/**
 * Basic auth route tests.
 * Run with: npx jest tests/auth.test.js
 *
 * Prerequisites:
 *   npm install --save-dev jest supertest
 *   Set TEST_MONGODB_URI in .env.test (use a separate test database!)
 */

const request = require("supertest");
const mongoose = require("mongoose");
const http = require("http");

// Set test env before importing app
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-do-not-use-in-production";
process.env.SUPERADMIN_ALLOWED_EMAILS = "testadmin@example.com";
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/antariya_test";

let app;
let server;

beforeAll(async () => {
  // Dynamic import to pick up test env vars
  const express = require("express");
  // Import app setup would go here — for now, test the schemas directly
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("Auth Validation Schemas", () => {
  const { googleLoginSchema, credentialsSignupSchema, credentialsLoginSchema } = require("../src/schemas/auth.schemas");

  describe("googleLoginSchema", () => {
    it("rejects missing googleAccessToken", () => {
      const result = googleLoginSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("accepts valid Google login payload", () => {
      const result = googleLoginSchema.safeParse({
        googleAccessToken: "ya29.a0AfH6SMBX...",
        role: "customer",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid role", () => {
      const result = googleLoginSchema.safeParse({
        googleAccessToken: "token",
        role: "hacker",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("credentialsSignupSchema", () => {
    it("rejects short password", () => {
      const result = credentialsSignupSchema.safeParse({
        email: "test@example.com",
        password: "123",
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain("8 characters");
    });

    it("rejects invalid email", () => {
      const result = credentialsSignupSchema.safeParse({
        email: "not-an-email",
        password: "validPassword123",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid signup", () => {
      const result = credentialsSignupSchema.safeParse({
        email: "user@example.com",
        password: "securePassword123",
        displayName: "Test User",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("credentialsLoginSchema", () => {
    it("rejects missing password", () => {
      const result = credentialsLoginSchema.safeParse({
        email: "test@example.com",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid login", () => {
      const result = credentialsLoginSchema.safeParse({
        email: "user@example.com",
        password: "myPassword123",
      });
      expect(result.success).toBe(true);
    });
  });
});

describe("Payment Validation Schemas", () => {
  const { createRazorpayOrderSchema, verifyPaymentSchema } = require("../src/schemas/payment.schemas");

  it("rejects amount below 100 paise", () => {
    const result = createRazorpayOrderSchema.safeParse({ amount: 50 });
    expect(result.success).toBe(false);
  });

  it("accepts valid payment order", () => {
    const result = createRazorpayOrderSchema.safeParse({
      amount: 149900,
      currency: "INR",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing verify fields", () => {
    const result = verifyPaymentSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("Order Validation Schema", () => {
  const { createOrderSchema } = require("../src/schemas/order.schemas");

  it("rejects empty items array", () => {
    const result = createOrderSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects item with quantity 0", () => {
    const result = createOrderSchema.safeParse({
      items: [{ productId: "abc123", quantity: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid order", () => {
    const result = createOrderSchema.safeParse({
      items: [
        { productId: "6507a1b2c3d4e5f6a7b8c9d0", quantity: 2 },
      ],
      razorpay_order_id: "order_abc123",
      razorpay_payment_id: "pay_abc123",
      razorpay_signature: "signature_abc123",
    });
    expect(result.success).toBe(true);
  });
});
