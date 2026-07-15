const { z } = require("zod");

const googleLoginSchema = z.object({
  googleAccessToken: z.string().min(1, "googleAccessToken is required"),
  role: z.enum(["customer", "admin", "superadmin"]).nullable().optional(),
  tokenType: z.string().optional().default("Bearer"),
  scope: z.string().nullable().optional(),
  expiresIn: z.union([z.number(), z.string()]).nullable().optional(),
});

const credentialsSignupSchema = z.object({
  email: z.string().email("Invalid email address").max(320),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  displayName: z.string().max(100).optional(),
  role: z.enum(["customer", "admin", "superadmin"]).optional().default("customer"),
});

const credentialsLoginSchema = z.object({
  email: z.string().email("Invalid email address").max(320),
  password: z.string().min(1, "Password is required").max(128),
  role: z.enum(["customer", "admin", "superadmin"]).optional(),
});

module.exports = {
  googleLoginSchema,
  credentialsSignupSchema,
  credentialsLoginSchema,
};
