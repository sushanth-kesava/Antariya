const xmlrpc = require("xmlrpc");

class OdooClient {
  constructor({ url, db, username, password }) {
    if (!url || !db || !username || !password) {
      throw new Error("Missing Odoo configuration");
    }

    // Ensure url has no trailing slash
    this.url = url.replace(/\/$/, "");
    this.db = db;
    this.username = username;
    this.password = password;

    this.uid = null;
    this.userContext = null;
    this.isAuthenticated = false;

    // XML-RPC endpoints
    this.common = xmlrpc.createClient({ url: `${this.url}/xmlrpc/2/common` });
    this.object = xmlrpc.createClient({ url: `${this.url}/xmlrpc/2/object` });
  }

  async authenticate() {
    if (this.isAuthenticated && this.uid) return { uid: this.uid, db: this.db };

    return new Promise((resolve, reject) => {
      this.common.methodCall(
        "authenticate",
        [this.db, this.username, this.password, {}],
        (err, uid) => {
          if (err) return reject(err);
          if (!uid) return reject(new Error("Failed to authenticate to Odoo"));

          this.uid = uid;
          this.isAuthenticated = true;
          resolve({ uid, db: this.db });
        }
      );
    });
  }

  // Generic RPC call to object endpoint
  async call(model, method, params = []) {
    if (!this.isAuthenticated) {
      await this.authenticate();
    }

    return new Promise((resolve, reject) => {
      const args = [this.db, this.uid, this.password, model, method, params];
      this.object.methodCall("execute_kw", args, (err, value) => {
        if (err) return reject(err);
        resolve(value);
      });
    });
  }
}

module.exports = OdooClient;
