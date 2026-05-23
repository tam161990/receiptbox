/**
 * Country-specific provider interfaces — implementations come per launch country.
 */

import type { ExpenseCategory } from "@/lib/enums";
import type { CountryCode } from "@/config/countries";

export interface ExpenseRuleContext {
  category: ExpenseCategory;
  vendorName?: string | null;
  totalAmount?: number | null;
}

export interface ExpenseRuleResult {
  deductibleStatus?: string;
  deductiblePercent?: number;
  needsReview?: boolean;
  reason?: string;
}

/** Country-specific expense classification and deductible rules. */
export interface ExpenseRulesProvider {
  readonly countryCode: CountryCode;
  evaluateExpense(ctx: ExpenseRuleContext): ExpenseRuleResult | null;
}

export interface TaxPeriod {
  year: number;
  quarter?: 1 | 2 | 3 | 4;
}

/** Country-specific tax calendar and declaration helpers. */
export interface TaxRulesProvider {
  readonly countryCode: CountryCode;
  getDeclarationPeriods(year: number): TaxPeriod[];
  formatTaxReference(code: string): string;
}

export interface DocumentCategoryDefinition {
  code: string;
  label: string;
  parentCategory?: ExpenseCategory;
}

/** Country-specific category lists and labels. */
export interface DocumentCategoriesProvider {
  readonly countryCode: CountryCode;
  getCategories(): DocumentCategoryDefinition[];
}

export interface CountryTheme {
  primaryColor: string;
  accentColor: string;
  logoPath: string;
}

/** Country branding tokens for UI theming. */
export interface CountryThemeProvider {
  readonly countryCode: CountryCode;
  getTheme(): CountryTheme;
}

// Future implementations:
// - LatviaExpenseRulesProvider
// - LithuaniaExpenseRulesProvider
// - EstoniaExpenseRulesProvider
