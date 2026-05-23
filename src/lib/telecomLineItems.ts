import type { LineItem } from "./lineItems";
import { inferVat, round2, LV_VAT_RATE, vatTripleFromNet } from "./lineItems";

export function isTelecomVendor(vendorName: string | null | undefined): boolean {
  if (!vendorName?.trim()) return false;
  const s = vendorName.toLowerCase();
  return /\b(lmt|tele2|bite|tet)\b/.test(s);
}

/** net field holds «Kopā ar PVN» while vatAmount is the real PVN line. */
function looksLikeGrossWithCorrectVat(gross: number, vat: number): boolean {
  const impliedNet = round2(gross - vat);
  if (impliedNet <= 0) return false;
  return (
    Math.abs(impliedNet * (1 + LV_VAT_RATE) - gross) <= 0.04 &&
    Math.abs(impliedNet * LV_VAT_RATE - vat) <= 0.04
  );
}

/** Fix LMT/telecom rows where AI used «Kopā ar PVN» as the line net amount. */
export function normalizeTelecomLineItems(items: LineItem[]): LineItem[] {
  return items.map((item) => {
    let netAmount = item.netAmount;
    let vatAmount = item.vatAmount;
    let totalAmount = item.totalAmount;

    if (
      netAmount != null &&
      vatAmount != null &&
      vatAmount > 0 &&
      looksLikeGrossWithCorrectVat(netAmount, vatAmount)
    ) {
      netAmount = round2(netAmount - vatAmount);
      totalAmount = null;
      vatAmount = null;
    }

    if (netAmount != null && Number.isFinite(netAmount)) {
      const vat = vatTripleFromNet(netAmount);
      return {
        ...item,
        netAmount: vat.netAmount,
        vatAmount: vat.vatAmount,
        totalAmount: vat.totalAmount,
        vatAssumed: true,
      };
    }

    if (totalAmount != null && Number.isFinite(totalAmount)) {
      const net = round2(totalAmount / (1 + LV_VAT_RATE));
      const vat = vatTripleFromNet(net);
      return {
        ...item,
        netAmount: vat.netAmount,
        vatAmount: vat.vatAmount,
        totalAmount: vat.totalAmount,
        vatAssumed: true,
      };
    }

    return item;
  });
}

/** When only gross «Kopā ar PVN» was parsed for electricity, derive net + VAT. */
export function grossToNetTriple(gross: number): {
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
} {
  const vat = inferVat({ netAmount: null, vatAmount: null, totalAmount: gross });
  return {
    netAmount: vat.netAmount ?? round2(gross / 1.21),
    vatAmount: vat.vatAmount ?? round2(gross - gross / 1.21),
    totalAmount: gross,
  };
}
