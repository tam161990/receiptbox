/**
 * Multi-country configuration — Latvia launches first; LT/EE prepared for future.
 */

export const COUNTRY_CODES = ["LV", "LT", "EE"] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

export type TaxSystemCode =
  | "LV_SELF_EMPLOYED"
  | "LT_SELF_EMPLOYED"
  | "EE_SELF_EMPLOYED";

export interface CountryConfig {
  code: CountryCode;
  name: string;
  currency: "EUR";
  locale: string;
  language: string;
  taxSystem: TaxSystemCode;
  themeColor: string;
  countryIcon: string;
  enabled: boolean;
}

export const countryConfig: Record<CountryCode, CountryConfig> = {
  LV: {
    code: "LV",
    name: "Latvia",
    currency: "EUR",
    locale: "lv-LV",
    language: "lv",
    taxSystem: "LV_SELF_EMPLOYED",
    themeColor: "#9C1B34",
    countryIcon: "lv",
    enabled: true,
  },
  LT: {
    code: "LT",
    name: "Lithuania",
    currency: "EUR",
    locale: "lt-LT",
    language: "lt",
    taxSystem: "LT_SELF_EMPLOYED",
    themeColor: "#FDB913",
    countryIcon: "lt",
    enabled: false,
  },
  EE: {
    code: "EE",
    name: "Estonia",
    currency: "EUR",
    locale: "et-EE",
    language: "et",
    taxSystem: "EE_SELF_EMPLOYED",
    themeColor: "#4891D9",
    countryIcon: "ee",
    enabled: false,
  },
};

export function isCountryCode(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

export function getCountryConfig(code: CountryCode | string | null | undefined): CountryConfig {
  if (code && isCountryCode(code)) return countryConfig[code];
  return countryConfig.LV;
}

export const DEFAULT_COUNTRY_CODE: CountryCode = "LV";
