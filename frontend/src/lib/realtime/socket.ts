"use client";

import { io, type Socket } from "socket.io-client";
import { getApiBaseUrl } from "@/lib/api/base-url";

// Derive the Socket.IO server origin from the configured API base URL.
// The REST API lives at `<origin>/api`; Socket.IO listens on `<origin>` with
// its default path `/socket.io`. So we strip a trailing `/api` (and any
// trailing slash) to get the socket origin.
export function getSocketUrl(): string {
  const apiBase = getApiBaseUrl(); // e.g. https://api.example.com/api
  return apiBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

let socket: Socket | null = null;

// Lazily create a single shared socket connection for the whole app.
// `role` (when known) lets the backend join the client to a role room so it
// can receive staff-only alerts (low-stock, verification).
export function getSocket(role?: string): Socket {
  if (socket) {
    return socket;
  }

  const url = getSocketUrl();
  socket = io(url, {
    // Allow same-origin deployments to work without an explicit URL.
    autoConnect: true,
    withCredentials: true,
    transports: ["websocket", "polling"],
    auth: role ? { role } : undefined,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export type InventoryUpdate = {
  productId: string;
  variantSku: string;
  available: number;
  reserved: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  at: string;
};

export type LowStockAlert = {
  count: number;
  alerts: Array<{
    product: string;
    productName: string;
    variantSku: string;
    warehouse: string;
    available: number;
    threshold: number;
    status: string;
  }>;
  at: string;
};

export type InventoryAlert = {
  kind: string;
  issueCount: number;
  issues: Array<Record<string, unknown>>;
  at: string;
};
