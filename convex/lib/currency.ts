// Shared by backend and frontend. Plan prices are stored in GHS; other
// currencies are derived from "GHS per 1 unit" exchange rates.
export const CURRENCIES = ["GHS", "USD", "EUR", "GBP"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
export type FxRates = Record<CurrencyCode, number>;

// Fallback rates (GHS per 1 unit). Superadmin can override in platform config.
export const DEFAULT_FX_RATES: FxRates = { GHS: 1, USD: 11, EUR: 12.5, GBP: 14.5 };

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; name: string }> = {
  GHS: { symbol: "GH₵", name: "Ghanaian Cedi" },
  USD: { symbol: "$", name: "US Dollar" },
  EUR: { symbol: "€", name: "Euro" },
  GBP: { symbol: "£", name: "British Pound" },
};

export function isCurrency(value: string): value is CurrencyCode {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function convertFromGHS(amountGHS: number, currency: CurrencyCode, rates: FxRates): number {
  return Math.round((amountGHS / rates[currency]) * 100) / 100;
}

export function convertToGHS(amount: number, currency: CurrencyCode, rates: FxRates): number {
  return Math.round(amount * rates[currency] * 100) / 100;
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const { symbol } = CURRENCY_META[currency];
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const EURO_REGIONS = ["DE", "FR", "ES", "IT", "NL", "BE", "PT", "IE", "AT", "FI", "GR", "LU"];

// Best-guess currency from a locale region such as "GH" or "GB"
export function currencyForRegion(region: string | undefined): CurrencyCode {
  if (!region) return "GHS";
  const r = region.toUpperCase();
  if (r === "GB") return "GBP";
  if (r === "US") return "USD";
  if (EURO_REGIONS.includes(r)) return "EUR";
  return "GHS";
}
