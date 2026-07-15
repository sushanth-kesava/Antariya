const { ZodError } = require("zod");

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * Usage: router.post("/route", validate(mySchema), controller);
 */
function validate(schema) {
  return function validateMiddleware(req, res, next) {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed; // replace with sanitized/typed data
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: issues,
        });
      }

      return next(error);
    }
  };
}

/**
 * Validates req.query against a Zod schema.
 */
function validateQuery(schema) {
  return function validateQueryMiddleware(req, res, next) {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Query validation failed",
          errors: issues,
        });
      }

      return next(error);
    }
  };
}

/**
 * Validates req.params against a Zod schema.
 */
function validateParams(schema) {
  return function validateParamsMiddleware(req, res, next) {
    try {
      const parsed = schema.parse(req.params);
      req.params = parsed;
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));

        return res.status(400).json({
          success: false,
          message: "Path parameter validation failed",
          errors: issues,
        });
      }

      return next(error);
    }
  };
}

module.exports = { validate, validateQuery, validateParams };
