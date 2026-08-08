/**
 * Tests for getAvailableCoupons — the customer-facing "coupons I can see" endpoint.
 *
 * Guarantees the trust-critical behavior:
 *   - RESTRICTED coupons (e.g. "Antariya's Waitlisted Insiders") are returned
 *     ONLY to customers whose email is on the allow-list.
 *   - Other customers (and guests) never see restricted coupons.
 *   - PUBLIC coupons are always included for authenticated users.
 *
 * Pure-logic: the Coupon model is mocked, so no database is required.
 * Run with: npx jest tests/coupon-visibility.test.js
 */

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.SUPERADMIN_ALLOWED_EMAILS = "testadmin@example.com";
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/antariya_test";

// ─── Mock the Coupon model BEFORE requiring the controller ───────────────────
// getAvailableCoupons calls: Coupon.find(query).select(...).sort(...).lean()
// We capture the query and return a canned dataset filtered the same way Mongo
// would, so we assert both the query shape AND the returned result.
let lastQuery = null;

const FIXTURES = [
  {
    code: "PUBLIC10", title: "Welcome 10%", visibility: "public",
    discountType: "percentage", discountValue: 10, minOrderValue: 0,
    maxUses: null, currentUses: 0, allowedEmails: [],
  },
  {
    code: "INSIDERS25", title: "Antariya's Waitlisted Insiders", visibility: "restricted",
    discountType: "percentage", discountValue: 25, minOrderValue: 0,
    maxUses: null, currentUses: 0, allowedEmails: ["insider@example.com"],
  },
  {
    code: "MAXEDOUT", title: "Used up public", visibility: "public",
    discountType: "flat", discountValue: 5000, minOrderValue: 0,
    maxUses: 5, currentUses: 5, allowedEmails: [],
  },
];

jest.mock("../src/models/Coupon", () => {
  // Emulate the subset of the Mongo query used by getAvailableCoupons.
  const applyQuery = (query) => {
    const orClauses = query.$or || [];
    return FIXTURES.filter((c) => {
      // active / validity are always-true in fixtures; the $or drives visibility.
      return orClauses.some((clause) => {
        if (clause.visibility === "public") return c.visibility === "public";
        if (clause.visibility === "restricted") {
          return (
            c.visibility === "restricted" &&
            Array.isArray(c.allowedEmails) &&
            c.allowedEmails.includes(clause.allowedEmails)
          );
        }
        return false;
      });
    });
  };

  return {
    find: (query) => {
      lastQuery = query;
      const rows = applyQuery(query);
      const chain = {
        select: () => chain,
        sort: () => chain,
        lean: async () => rows.map((r) => ({ ...r })),
      };
      return chain;
    },
  };
});

const { getAvailableCoupons } = require("../src/controllers/coupon.controller");

// Minimal Express req/res doubles.
function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const run = async (email) => {
  const req = { auth: email ? { email, sub: "u1" } : {} };
  const res = makeRes();
  await getAvailableCoupons(req, res, (err) => { throw err; });
  return res;
};

describe("getAvailableCoupons — restricted coupon visibility", () => {
  beforeEach(() => { lastQuery = null; });

  it("shows a restricted coupon to an allowed insider email", async () => {
    const res = await run("insider@example.com");
    expect(res.statusCode).toBe(200);
    const codes = res.body.coupons.map((c) => c.code);
    expect(codes).toContain("INSIDERS25");
    expect(codes).toContain("PUBLIC10");
  });

  it("HIDES the restricted coupon from a non-allowed customer", async () => {
    const res = await run("random@example.com");
    const codes = res.body.coupons.map((c) => c.code);
    expect(codes).not.toContain("INSIDERS25");
    expect(codes).toContain("PUBLIC10");
  });

  it("normalizes email case/whitespace before matching the allow-list", async () => {
    const res = await run("  INSIDER@Example.com  ");
    const codes = res.body.coupons.map((c) => c.code);
    expect(codes).toContain("INSIDERS25");
  });

  it("guests (no auth email) never receive restricted coupons", async () => {
    const res = await run(null);
    const codes = res.body.coupons.map((c) => c.code);
    expect(codes).not.toContain("INSIDERS25");
    // The query must not add a restricted clause when there is no email.
    const hasRestrictedClause = (lastQuery.$or || []).some(
      (c) => c.visibility === "restricted"
    );
    expect(hasRestrictedClause).toBe(false);
  });

  it("excludes coupons that have hit their global usage cap", async () => {
    const res = await run("insider@example.com");
    const codes = res.body.coupons.map((c) => c.code);
    expect(codes).not.toContain("MAXEDOUT");
  });

  it("always filters by active + validity window in the query", async () => {
    await run("insider@example.com");
    expect(lastQuery.active).toBe(true);
    expect(lastQuery.validFrom).toHaveProperty("$lte");
    expect(lastQuery.validUntil).toHaveProperty("$gte");
  });
});
