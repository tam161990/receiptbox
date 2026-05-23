import type { Quarter } from "./enums";

export function parseQuarter(value: string | null | undefined): Quarter {
  switch ((value ?? "").toUpperCase()) {
    case "Q1":
      return "Q1";
    case "Q2":
      return "Q2";
    case "Q3":
      return "Q3";
    case "Q4":
      return "Q4";
    case "ALL":
    case "":
    case "VISS":
    case "VISSGADS":
    case "VISS_GADS":
      return "ALL";
    default:
      return "ALL";
  }
}

export function quarterRange(year: number, quarter: Quarter): { start: Date; end: Date } {
  if (quarter === "ALL") {
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }
  const startMonth = { Q1: 0, Q2: 3, Q3: 6, Q4: 9 }[quarter];
  const endMonth = startMonth + 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, endMonth, 1)),
  };
}

export function formatLvDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatLvMoney(value: number | null | undefined, currency = "EUR"): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const formatted = value.toLocaleString("lv-LV", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${formatted} ${currency}`;
}

export function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Accept YYYY-MM-DD or full ISO strings.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (!match) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}
