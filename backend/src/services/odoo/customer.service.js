const authService = require("./auth.service");

/**
 * Transform raw Odoo res.partner data to API response format.
 * Safely handles missing fields.
 */
function transformCustomer(odooPartner) {
  if (!odooPartner) return null;

  return {
    id: odooPartner.id,
    name: odooPartner.name || "",
    email: odooPartner.email || "",
    phone: odooPartner.phone || "",
    mobile: odooPartner.mobile || "",
    company: odooPartner.company_name || "",
    gst: odooPartner.vat || "",
    street: odooPartner.street || "",
    street2: odooPartner.street2 || "",
    city: odooPartner.city || "",
    state: odooPartner.state_id ? odooPartner.state_id[1] : "",
    zipCode: odooPartner.zip || "",
    country: odooPartner.country_id ? odooPartner.country_id[1] : "",
    active: odooPartner.active !== false,
    isCompany: odooPartner.is_company || false,
    type: odooPartner.type || "contact",
    createdAt: odooPartner.create_date,
    updatedAt: odooPartner.write_date,
  };
}

/**
 * Validate customer data before creating/updating.
 * Returns validation error if invalid, null if valid.
 */
function validateCustomerData(data) {
  if (!data) return "Customer data is required";

  const { name, email } = data;

  if (!name || name.trim().length === 0) {
    return "Customer name is required";
  }

  if (!email || email.trim().length === 0) {
    return "Customer email is required";
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Invalid email format";
  }

  return null;
}

/**
 * Search for existing customer by email.
 * Returns customer object if found, null if not found.
 */
async function findCustomerByEmail(email) {
  if (!email || email.trim().length === 0) {
    throw new Error("Email is required");
  }

  const client = await authService.getClient();

  try {
    const partnerIds = await client.call("res.partner", "search", [
      [["email", "=", email.trim().toLowerCase()]],
      { limit: 1 },
    ]);

    if (!partnerIds || partnerIds.length === 0) {
      return null;
    }

    const fields = [
      "id",
      "name",
      "email",
      "phone",
      "mobile",
      "company_name",
      "vat",
      "street",
      "street2",
      "city",
      "state_id",
      "zip",
      "country_id",
      "active",
      "is_company",
      "type",
      "create_date",
      "write_date",
    ];

    const results = await client.call("res.partner", "read", [partnerIds, fields]);

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    return transformCustomer(results[0]);
  } catch (err) {
    throw new Error(`Failed to search customer by email: ${err.message}`);
  }
}

/**
 * Fetch customer by ID from Odoo.
 * Returns customer object if found, null if not found.
 */
async function getCustomerById(customerId) {
  if (!customerId) {
    throw new Error("Customer ID is required");
  }

  const client = await authService.getClient();

  try {
    const fields = [
      "id",
      "name",
      "email",
      "phone",
      "mobile",
      "company_name",
      "vat",
      "street",
      "street2",
      "city",
      "state_id",
      "zip",
      "country_id",
      "active",
      "is_company",
      "type",
      "child_ids",
      "create_date",
      "write_date",
    ];

    const results = await client.call("res.partner", "read", [
      [parseInt(customerId)],
      fields,
    ]);

    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const customer = transformCustomer(results[0]);

    // Fetch addresses (child_ids)
    if (results[0].child_ids && Array.isArray(results[0].child_ids)) {
      const addresses = await client.call("res.partner", "read", [
        results[0].child_ids,
        ["id", "name", "type", "street", "street2", "city", "state_id", "zip", "country_id", "email", "phone"],
      ]);

      if (Array.isArray(addresses)) {
        customer.addresses = addresses
          .map((addr) => ({
            id: addr.id,
            name: addr.name || "",
            type: addr.type || "contact",
            street: addr.street || "",
            street2: addr.street2 || "",
            city: addr.city || "",
            state: addr.state_id ? addr.state_id[1] : "",
            zipCode: addr.zip || "",
            country: addr.country_id ? addr.country_id[1] : "",
            email: addr.email || "",
            phone: addr.phone || "",
          }))
          .filter(Boolean);
      }
    }

    return customer;
  } catch (err) {
    throw new Error(`Failed to fetch customer: ${err.message}`);
  }
}

/**
 * Create a new customer in Odoo.
 * Checks for duplicates first by email.
 * Returns created customer object.
 */
async function createCustomer(data) {
  const validationError = validateCustomerData(data);
  if (validationError) {
    throw new Error(validationError);
  }

  const client = await authService.getClient();

  try {
    // Check for existing customer by email
    const existing = await findCustomerByEmail(data.email);
    if (existing) {
      throw new Error(`Customer with email ${data.email} already exists (ID: ${existing.id})`);
    }

    // Prepare customer data for Odoo
    const partnerData = {
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone || "",
      mobile: data.mobile || "",
      company_name: data.company || "",
      vat: data.gst || "",
      street: data.street || data.address || "",
      street2: data.street2 || "",
      city: data.city || "",
      zip: data.zipCode || data.zip || "",
      is_company: data.isCompany === true,
      type: "contact",
      active: true,
    };

    // Add country if provided
    if (data.country) {
      // Search for country by code or name
      const countryIds = await client.call("res.country", "search", [
        ["|", ["code", "=", data.country], ["name", "=", data.country]],
        { limit: 1 },
      ]);
      if (countryIds && countryIds.length > 0) {
        partnerData.country_id = countryIds[0];
      }
    }

    // Add state if provided
    if (data.state && data.country) {
      const stateIds = await client.call("res.country.state", "search", [
        ["|", ["code", "=", data.state], ["name", "=", data.state]],
      ]);
      if (stateIds && stateIds.length > 0) {
        partnerData.state_id = stateIds[0];
      }
    }

    // Create customer in Odoo
    const customerId = await client.call("res.partner", "create", [partnerData]);

    if (!customerId) {
      throw new Error("Failed to create customer in Odoo");
    }

    // Create shipping address if provided
    if (data.shippingAddress) {
      const shippingData = {
        name: data.shippingAddress.name || data.name,
        parent_id: customerId,
        type: "delivery",
        street: data.shippingAddress.street || "",
        street2: data.shippingAddress.street2 || "",
        city: data.shippingAddress.city || "",
        zip: data.shippingAddress.zipCode || "",
        email: data.shippingAddress.email || data.email,
        phone: data.shippingAddress.phone || data.phone || "",
        active: true,
      };

      if (data.shippingAddress.country) {
        const countryIds = await client.call("res.country", "search", [
          ["|", ["code", "=", data.shippingAddress.country], ["name", "=", data.shippingAddress.country]],
          { limit: 1 },
        ]);
        if (countryIds && countryIds.length > 0) {
          shippingData.country_id = countryIds[0];
        }
      }

      await client.call("res.partner", "create", [shippingData]);
    }

    // Create billing address if provided
    if (data.billingAddress) {
      const billingData = {
        name: data.billingAddress.name || data.name,
        parent_id: customerId,
        type: "invoice",
        street: data.billingAddress.street || "",
        street2: data.billingAddress.street2 || "",
        city: data.billingAddress.city || "",
        zip: data.billingAddress.zipCode || "",
        email: data.billingAddress.email || data.email,
        phone: data.billingAddress.phone || data.phone || "",
        active: true,
      };

      if (data.billingAddress.country) {
        const countryIds = await client.call("res.country", "search", [
          ["|", ["code", "=", data.billingAddress.country], ["name", "=", data.billingAddress.country]],
          { limit: 1 },
        ]);
        if (countryIds && countryIds.length > 0) {
          billingData.country_id = countryIds[0];
        }
      }

      await client.call("res.partner", "create", [billingData]);
    }

    // Fetch and return created customer
    return await getCustomerById(customerId);
  } catch (err) {
    throw new Error(`Failed to create customer: ${err.message}`);
  }
}

/**
 * Update customer in Odoo.
 * Only updates fields that are provided.
 * Returns updated customer object.
 */
async function updateCustomer(customerId, data) {
  if (!customerId) {
    throw new Error("Customer ID is required");
  }

  if (!data || Object.keys(data).length === 0) {
    throw new Error("At least one field must be provided to update");
  }

  const client = await authService.getClient();

  try {
    // Verify customer exists
    const existing = await getCustomerById(customerId);
    if (!existing) {
      throw new Error("Customer not found");
    }

    // Check if email is being changed
    if (data.email && data.email !== existing.email) {
      const emailExists = await findCustomerByEmail(data.email);
      if (emailExists) {
        throw new Error(`Email ${data.email} is already in use by another customer`);
      }
    }

    // Prepare update data (only provided fields)
    const updateData = {};

    if (data.name) updateData.name = data.name.trim();
    if (data.email) updateData.email = data.email.trim().toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone || "";
    if (data.mobile !== undefined) updateData.mobile = data.mobile || "";
    if (data.company !== undefined) updateData.company_name = data.company || "";
    if (data.gst !== undefined) updateData.vat = data.gst || "";
    if (data.street !== undefined) updateData.street = data.street || "";
    if (data.street2 !== undefined) updateData.street2 = data.street2 || "";
    if (data.city !== undefined) updateData.city = data.city || "";
    if (data.zipCode !== undefined) updateData.zip = data.zipCode || "";

    // Update customer in Odoo
    await client.call("res.partner", "write", [[parseInt(customerId)], updateData]);

    // Fetch and return updated customer
    return await getCustomerById(customerId);
  } catch (err) {
    throw new Error(`Failed to update customer: ${err.message}`);
  }
}

/**
 * Sync or create customer from website registration.
 * If customer exists by email, returns existing customer.
 * Otherwise, creates new customer and returns it.
 */
async function syncCustomer(data) {
  if (!data.email) {
    throw new Error("Email is required for synchronization");
  }

  try {
    // Check if customer exists
    const existing = await findCustomerByEmail(data.email);
    if (existing) {
      return {
        created: false,
        customer: existing,
      };
    }

    // Create new customer
    const created = await createCustomer(data);
    return {
      created: true,
      customer: created,
    };
  } catch (err) {
    throw new Error(`Failed to sync customer: ${err.message}`);
  }
}

module.exports = {
  findCustomerByEmail,
  getCustomerById,
  createCustomer,
  updateCustomer,
  syncCustomer,
  validateCustomerData,
  transformCustomer,
};
