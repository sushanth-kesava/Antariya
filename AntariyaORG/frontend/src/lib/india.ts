export const INDIA_LOCALE = "en-IN";
export const INDIA_CURRENCY = "INR";
export const LEGACY_USD_TO_INR_RATE = 83;

export const INDIA_GST_RATE = 0.18;
export const INDIA_FREE_SHIPPING_THRESHOLD = 1499;
export const INDIA_STANDARD_SHIPPING = 99;

export function formatINR(amount: number): string {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat(INDIA_LOCALE, {
    style: "currency",
    currency: INDIA_CURRENCY,
    maximumFractionDigits: 2,
  }).format(value);
}

export function normalizeCatalogPriceToINR(price: number): number {
  const value = Number.isFinite(Number(price)) ? Number(price) : 0;
  return value > 0 && value <= 200 ? value * LEGACY_USD_TO_INR_RATE : value;
}

export function formatIndianDate(dateInput: string | number | Date): string {
  return new Date(dateInput).toLocaleDateString(INDIA_LOCALE);
}

export function formatIndianDateTime(dateInput: string | number | Date): string {
  return new Date(dateInput).toLocaleString(INDIA_LOCALE);
}
