"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSocket,
  type LowStockAlert,
  type InventoryAlert,
} from "@/lib/realtime/socket";

// Staff-only hook (admin / warehouse / vendor dashboards). Joins the client's
// role room via the socket auth handshake and surfaces low-stock and
// verification/anomaly alerts pushed by the backend.
export function useInventoryAlerts(role: "admin" | "warehouse" | "vendor" | "superadmin") {
  const [lowStock, setLowStock] = useState<LowStockAlert | null>(null);
  const [alert, setAlert] = useState<InventoryAlert | null>(null);
  const [history, setHistory] = useState<Array<LowStockAlert | InventoryAlert>>([]);
  const historyRef = useRef<Array<LowStockAlert | InventoryAlert>>([]);

  useEffect(() => {
    const socket = getSocket(role);

    const handleLowStock = (payload: LowStockAlert) => {
      setLowStock(payload);
      historyRef.current = [payload, ...historyRef.current].slice(0, 50);
      setHistory(historyRef.current);
    };

    const handleAlert = (payload: InventoryAlert) => {
      setAlert(payload);
      historyRef.current = [payload, ...historyRef.current].slice(0, 50);
      setHistory(historyRef.current);
    };

    socket.on("inventory:low-stock", handleLowStock);
    socket.on("inventory:alert", handleAlert);

    return () => {
      socket.off("inventory:low-stock", handleLowStock);
      socket.off("inventory:alert", handleAlert);
    };
  }, [role]);

  return { lowStock, alert, history };
}
