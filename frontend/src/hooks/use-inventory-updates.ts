"use client";

import { useEffect, useRef, useState } from "react";
import {
  getSocket,
  type InventoryUpdate,
} from "@/lib/realtime/socket";

// Subscribe to live inventory updates.
//
// Two usage modes:
//   1. Watch a single product page — pass a productId. The hook joins the
//      `product:<id>` room and returns a map of latest updates keyed by
//      variantSku ("" for no-variant products).
//   2. Global listener — omit productId to receive every inventory:update
//      (used by dashboards that show many products at once); pass an onUpdate
//      callback to react to each event.
export function useInventoryUpdates(options?: {
  productId?: string;
  role?: string;
  onUpdate?: (update: InventoryUpdate) => void;
}) {
  const { productId, role, onUpdate } = options || {};
  const [updates, setUpdates] = useState<Record<string, InventoryUpdate>>({});
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const socket = getSocket(role);

    const handleConnect = () => {
      if (productId) {
        socket.emit("watch:product", productId);
      }
    };

    const handleUpdate = (payload: InventoryUpdate) => {
      // When watching a specific product, ignore unrelated broadcasts.
      if (productId && payload.productId !== productId) {
        return;
      }
      setUpdates((prev) => ({ ...prev, [payload.variantSku || ""]: payload }));
      onUpdateRef.current?.(payload);
    };

    if (socket.connected) {
      handleConnect();
    }
    socket.on("connect", handleConnect);
    socket.on("inventory:update", handleUpdate);

    return () => {
      if (productId) {
        socket.emit("unwatch:product", productId);
      }
      socket.off("connect", handleConnect);
      socket.off("inventory:update", handleUpdate);
    };
  }, [productId, role]);

  return updates;
}
