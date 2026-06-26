const OdooClient = require("./odoo.client");
const odooConfig = require("../../config/odoo");

let singleton = null;

function createClient() {
  if (singleton) return singleton;

  // Do not log or expose any credentials
  const client = new OdooClient({
    url: odooConfig.url,
    db: odooConfig.db,
    username: odooConfig.username,
    password: odooConfig.password,
  });

  singleton = client;
  return singleton;
}

async function getClient() {
  const client = createClient();
  await client.authenticate();
  return client;
}

async function getSessionInfo() {
  const client = await getClient();
  // Try to fetch user info from res.users
  let user = null;
  try {
    const data = await client.call("res.users", "read", [[client.uid], ["login", "name"]]);
    if (Array.isArray(data) && data.length > 0) {
      user = data[0];
    }
  } catch (err) {
    // swallow - we still return uid/db even if user read fails
    user = null;
  }

  return {
    connected: true,
    database: client.db,
    uid: client.uid,
    user,
  };
}

module.exports = {
  getClient,
  getSessionInfo,
};
