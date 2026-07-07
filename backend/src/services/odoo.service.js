const xmlrpc = require("xmlrpc");
const env = require("../config/env");

function createClient(path) {
  const url = new URL(path, env.odooUrl);
  const opts = { host: url.hostname, port: url.port || (url.protocol === "https:" ? 443 : 80), path: url.pathname };
  return url.protocol === "https:" ? xmlrpc.createSecureClient(opts) : xmlrpc.createClient(opts);
}

function call(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, val) => (err ? reject(err) : resolve(val)));
  });
}

async function authenticate() {
  const client = createClient("/xmlrpc/2/common");
  const uid = await call(client, "authenticate", [env.odooDb, env.odooUsername, env.odooPassword, {}]);
  if (!uid) throw new Error("Odoo authentication failed");
  return uid;
}

async function searchRead(model, domain, fields, opts = {}) {
  const uid = await authenticate();
  const client = createClient("/xmlrpc/2/object");
  return call(client, "execute_kw", [
    env.odooDb, uid, env.odooPassword,
    model, "search_read",
    [domain],
    { fields, limit: opts.limit || 100, offset: opts.offset || 0, order: opts.order || "id asc" },
  ]);
}

async function getProducts({ limit = 100, offset = 0, search = "" } = {}) {
  const domain = [["sale_ok", "=", true], ["active", "=", true]];
  if (search) domain.push(["name", "ilike", search]);

  const fields = ["id", "name", "description_sale", "list_price", "categ_id", "image_1920", "qty_available", "default_code"];
  const records = await searchRead("product.template", domain, fields, { limit, offset });

  return records.map((p) => ({
    id: `odoo_${p.id}`,
    odooId: p.id,
    name: p.name,
    description: p.description_sale || p.name,
    price: p.list_price,
    category: Array.isArray(p.categ_id) ? p.categ_id[1] : "Uncategorized",
    sku: p.default_code || null,
    stock: p.qty_available || 0,
    image: p.image_1920 ? `data:image/png;base64,${p.image_1920}` : null,
    images: p.image_1920 ? [`data:image/png;base64,${p.image_1920}`] : [],
    source: "odoo",
  }));
}

async function getProductById(odooId) {
  const fields = ["id", "name", "description_sale", "list_price", "categ_id", "image_1920", "qty_available", "default_code"];
  const records = await searchRead("product.template", [["id", "=", Number(odooId)]], fields, { limit: 1 });
  if (!records.length) return null;
  const p = records[0];
  return {
    id: `odoo_${p.id}`,
    odooId: p.id,
    name: p.name,
    description: p.description_sale || p.name,
    price: p.list_price,
    category: Array.isArray(p.categ_id) ? p.categ_id[1] : "Uncategorized",
    sku: p.default_code || null,
    stock: p.qty_available || 0,
    image: p.image_1920 ? `data:image/png;base64,${p.image_1920}` : null,
    images: p.image_1920 ? [`data:image/png;base64,${p.image_1920}`] : [],
    source: "odoo",
  };
}

module.exports = { getProducts, getProductById };
