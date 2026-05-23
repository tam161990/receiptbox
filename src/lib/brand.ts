/**
 * Brand configuration per country — use getBrand() instead of hardcoding "ReceiptBox LV".
 */

import {
  DEFAULT_COUNTRY_CODE,
  getCountryConfig,
  type CountryCode,
} from "@/config/countries";

export interface BrandConfig {
  appName: string;
  countryCode: CountryCode;
  themeColor: string;
  iconVariant: "base" | "base-with-badge";
  countryBadgeEnabled: boolean;
  shortName: string;
  description: string;
}

export function getBrand(countryCode: CountryCode | string | null | undefined = DEFAULT_COUNTRY_CODE): BrandConfig {
  const country = getCountryConfig(countryCode);
  return {
    appName: `ReceiptBox ${country.code}`,
    shortName: "ReceiptBox",
    countryCode: country.code,
    themeColor: country.themeColor,
    iconVariant: country.code === "LV" ? "base" : "base-with-badge",
    countryBadgeEnabled: country.code !== "LV",
    description: "Vienkāršākais veids, kā sagatavot izdevumus deklarācijai",
  };
}

/** Resolve brand from env override (future multi-tenant hosting) or default LV. */
export function getBrandFromEnv(): BrandConfig {
  const envCountry = process.env.RECEIPTBOX_COUNTRY;
  return getBrand(envCountry ?? DEFAULT_COUNTRY_CODE);
}
