import { Product } from "@/app/lib/mock-data";

const CART_STORAGE_KEY = "stitchmart_cart";
export const CART_UPDATED_EVENT = "antariya-cart-updated";

export type ProductCustomization = {
  symbol: string;
  threadColor: string;
  fabricColor: string;
  size: "Small" | "Medium" | "Large";
  placement: string;
  referenceImage?: string;
  referenceImageName?: string;
  notes?: string;
};

export type CartItem = {
  lineId: string;
  productId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
  category: string;
  customization?: ProductCustomization;
};

function buildCustomizationKey(customization?: ProductCustomization): string {
  if (!customization) {
    return "none";
  }

  return JSON.stringify(customization);
}

function buildLineId(productId: string) {
  return `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<CartItem>[]) : [];

    return parsed.map((item) => ({
      lineId: item.lineId || buildLineId(item.productId || "product"),
      productId: item.productId || "",
      name: item.name || "Product",
      image: item.image || "",
      price: Number(item.price || 0),
      quantity: Number(item.quantity || 1),
      category: item.category || "General",
      customization: item.customization,
    }));
  } catch {
    return [];
  }
}

export function setCartItems(items: CartItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function getCartItemCount(): number {
  return getCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

export function addProductToCart(product: Product, quantity = 1, customization?: ProductCustomization) {
  const existing = getCartItems();
  const customizationKey = buildCustomizationKey(customization);
  const index = existing.findIndex(
    (item) => item.productId === product.id && buildCustomizationKey(item.customization) === customizationKey
  );

  if (index >= 0) {
    existing[index] = {
      ...existing[index],
      quantity: existing[index].quantity + quantity,
    };
  } else {
    existing.push({
      lineId: buildLineId(product.id),
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity,
      category: product.category,
      customization,
    });
  }

  setCartItems(existing);
}

export function clearCart() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(CART_STORAGE_KEY);
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}
