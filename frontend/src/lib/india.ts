export const INDIA_LOCALE = "en-IN";
export const INDIA_CURRENCY = "INR";
export const INDIA_GST_RATE = 0;
export const INDIA_FREE_SHIPPING_THRESHOLD = 1499;
export const INDIA_STANDARD_SHIPPING = 49;

export function formatINR(amount: number): string {
  const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat(INDIA_LOCALE, {
    style: "currency",
    currency: INDIA_CURRENCY,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Legacy function — previously converted USD prices to INR.
 * Now a no-op passthrough since all catalog prices are stored in INR.
 */
export function normalizeCatalogPriceToINR(price: number): number {
  return Number.isFinite(Number(price)) ? Number(price) : 0;
}

export function formatIndianDate(dateInput: string | number | Date): string {
  return new Date(dateInput).toLocaleDateString(INDIA_LOCALE);
}

export function formatIndianDateTime(dateInput: string | number | Date): string {
  return new Date(dateInput).toLocaleString(INDIA_LOCALE);
}
