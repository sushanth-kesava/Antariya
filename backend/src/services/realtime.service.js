// Real-time fan-out layer for inventory (and future) events.
//
// Designed to degrade gracefully: if `socket.io` is not installed yet, this
// module becomes a no-op (logs once) so the backend still boots. Once you run
//   npm install socket.io
// and restart, attachRealtime() wires a Socket.IO server onto the existing
// HTTP server and events start broadcasting with zero further code changes.
//
// Rooms:
//   "inventory"            — every connected dashboard/storefront listener
//   `product:<productId>`  — clients viewing a specific product page
//   role rooms: "role:admin", "role:vendor", "role:warehouse", "role:customer"

let io = null;
let warnedNoIo = false;

function attachRealtime(httpServer, { allowedOrigins } = {}) {
  let SocketIoServer;
  try {
    ({ Server: SocketIoServer } = require("socket.io"));
  } catch (err) {
    if (!warnedNoIo) {
      console.warn(
        "[realtime] socket.io not installed — real-time inventory sync is DISABLED. " +
          "Run `npm install socket.io` and restart to enable it."
      );
      warnedNoIo = true;
    }
    return null;
  }

  io = new SocketIoServer(httpServer, {
    cors: {
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (!Array.isArray(allowedOrigins) || allowedOrigins.length === 0) return cb(null, true);
        return cb(null, allowedOrigins.includes(origin));
      },
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.join("inventory");

    const role = String(socket.handshake.auth?.role || socket.handshake.query?.role || "").toLowerCase();
    if (["admin", "vendor", "warehouse", "customer", "superadmin"].includes(role)) {
      socket.join(`role:${role}`);
    }

    // Clients viewing a product page subscribe for granular updates.
    socket.on("watch:product", (productId) => {
      if (typeof productId === "string" && productId.length > 0) {
        socket.join(`product:${productId}`);
      }
    });
    socket.on("unwatch:product", (productId) => {
      if (typeof productId === "string" && productId.length > 0) {
        socket.leave(`product:${productId}`);
      }
    });
  });

  console.log("[realtime] Socket.IO attached — inventory sync ENABLED.");
  return io;
}

// Broadcast a single product/variant availability change to all listeners.
function emitInventoryChange(payload) {
  if (!io) return; // no-op when socket.io absent
  const event = "inventory:update";
  const body = { ...payload, at: new Date().toISOString() };
  io.to("inventory").emit(event, body);
  if (payload.productId) {
    io.to(`product:${payload.productId}`).emit(event, body);
  }
}

// Broadcast a low-stock / out-of-stock alert to staff dashboards only.
function emitLowStockAlert(payload) {
  if (!io) return;
  const body = { ...payload, at: new Date().toISOString() };
  io.to("role:admin").emit("inventory:low-stock", body);
  io.to("role:warehouse").emit("inventory:low-stock", body);
  io.to("role:vendor").emit("inventory:low-stock", body);
}

// Broadcast a verification/anomaly alert to admins + warehouse.
function emitInventoryAlert(payload) {
  if (!io) return;
  const body = { ...payload, at: new Date().toISOString() };
  io.to("role:admin").emit("inventory:alert", body);
  io.to("role:warehouse").emit("inventory:alert", body);
}

function isEnabled() {
  return Boolean(io);
}

module.exports = {
  attachRealtime,
  emitInventoryChange,
  emitLowStockAlert,
  emitInventoryAlert,
  isEnabled,
};
