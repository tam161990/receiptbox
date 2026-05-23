/**
 * Kādu identifikatoru pievienot profilā, lai ReceiptBox pareizi atfiltrētu
 * pozīcijas daudzrindu rēķinos.
 */
export interface VendorIdentifierGuide {
  /** Iekšējais kods */
  id: string;
  /** Nosaukums lietotājam */
  vendorLabel: string;
  /** Īss apakšvirsraksts (kategorija) */
  billType: string;
  /** Ko ievadīt profilā */
  whatToEnter: string;
  /** Piemēri */
  examples: string[];
  /** Ko labāk neievadīt (sajaucas ar citām rindām) */
  avoid?: string;
}

export const VENDOR_IDENTIFIER_GUIDES: readonly VendorIdentifierGuide[] = [
  {
    id: "lmt",
    vendorLabel: "LMT",
    billType: "Mobilo sakaru rēķins",
    whatToEnter: "Telefona numurs — tāds pats kā rēķinā (tavs līnijas numurs).",
    examples: ["29151160", "+37129151160"],
    avoid: "Ne adreses un ne konta numurs — tikai tālrunis.",
  },
  {
    id: "latvenergo",
    vendorLabel: "Latvenergo / Elektrum",
    billType: "Elektrības rēķins (vairākas adreses)",
    whatToEnter:
      "Adrese objektam — iela un dzīvoklis (piem. «Ieriķu iela 58-52»). Pietiek ar īsu fragmentu no rēķina tabulas.",
    examples: ["Ieriķu iela 58-52", "Brīvības iela 10-3, Rīga"],
    avoid:
      "Neskaitītāja numuru no Enefit — Latvenergo meklē pēc adreses rindas rēķinā.",
  },
  {
    id: "enefit",
    vendorLabel: "Enefit",
    billType: "Elektrības rēķins (vairāki pieslēgumi)",
    whatToEnter:
      "Elektroskaitītāja numurs no rēķina (8–12 cipari). Precīzāk nekā tikai adrese.",
    examples: ["5105143425", "Skaitītājs 5105143425"],
    avoid:
      "Tikai «58-52» bez skaitītāja var dot nepareizu summu. Pilnu adresi atstāj kā rezervi, ja skaitītājs PDF nav.",
  },
  {
    id: "generic",
    vendorLabel: "Citi pakalpojumi",
    billType: "Vispārīgi",
    whatToEnter:
      "Jebkurš unikāls teksts no rēķina: IBAN, līguma nr., klienta kods, valsts numurs u.c.",
    examples: ["LV80HABA…", "Klienta nr. 123456", "AB-1234"],
  },
] as const;

/** Īss teksts kļūdu ziņojumiem / AI kontekstam. */
export function formatIdentifierHintsForPrompt(): string {
  return VENDOR_IDENTIFIER_GUIDES.filter((g) => g.id !== "generic")
    .map((g) => `${g.vendorLabel}: ${g.whatToEnter}`)
    .join(" ");
}

/** Meklē padomu pēc piegādātāja nosaukuma dokumentā. */
export function findIdentifierGuideForVendor(
  vendorName: string | null | undefined,
): VendorIdentifierGuide | null {
  if (!vendorName?.trim()) return null;
  const s = vendorName.toLowerCase();
  if (s.includes("lmt")) return VENDOR_IDENTIFIER_GUIDES.find((g) => g.id === "lmt") ?? null;
  if (s.includes("enefit") || s.includes("enefo")) {
    return VENDOR_IDENTIFIER_GUIDES.find((g) => g.id === "enefit") ?? null;
  }
  if (
    s.includes("latvenergo") ||
    s.includes("elektrum") ||
    s.includes("aj power")
  ) {
    return VENDOR_IDENTIFIER_GUIDES.find((g) => g.id === "latvenergo") ?? null;
  }
  return null;
}

export function identifierHintLineForVendor(
  vendorName: string | null | undefined,
): string | null {
  const guide = findIdentifierGuideForVendor(vendorName);
  if (!guide) return null;
  return `${guide.vendorLabel}: ${guide.whatToEnter}`;
}

export type IdentifierKind = "meter" | "address" | "phone" | "point" | "other";

export type UtilityVendorKind = "enefit" | "latvenergo" | "other";

/** Classify a profile identifier (meter vs address vs phone). */
export function classifyIdentifier(id: string): IdentifierKind {
  const t = id.trim();
  const n = t.toLowerCase();
  if (/iela|bulv\.?aris|\bdzīv|\bdzivokl/i.test(t)) return "address";
  if (/^\d+\s*-\s*\d+$/.test(t) || /^\d+-\d+$/.test(t)) return "address";
  if (/skait[iī]t/i.test(t) && /\d{6,}/.test(t)) return "meter";
  if (/^\d{8,12}$/.test(t.replace(/\s/g, ""))) return "meter";
  if (/\b\d{2}[A-Za-z]-[A-Za-z0-9]+\b/.test(t)) return "point";
  if (/\bEL\d{10,}/i.test(t)) return "point";
  if (/^\+?\d{7,11}$/.test(t.replace(/[\s-]/g, ""))) return "phone";
  return "other";
}

export function utilityVendorKind(
  vendorHint: string | null | undefined,
): UtilityVendorKind {
  if (!vendorHint?.trim()) return "other";
  const s = vendorHint.toLowerCase();
  if (s.includes("enefit") || s.includes("enefo")) return "enefit";
  if (
    s.includes("latvenergo") ||
    s.includes("elektrum") ||
    s.includes("aj power")
  ) {
    return "latvenergo";
  }
  return "other";
}

/**
 * Latvenergo/Elektrum: only address identifiers (ignore Enefit skaitītājs).
 * Enefit and others: all profile identifiers — unchanged logic.
 */
export function identifiersForUtilityVendor(
  myIdentifiers: readonly string[],
  vendorHint?: string | null,
): string[] {
  if (myIdentifiers.length === 0) return [];
  const vk = utilityVendorKind(vendorHint);

  if (vk === "latvenergo") {
    const addresses = myIdentifiers.filter((id) => classifyIdentifier(id) === "address");
    if (addresses.length > 0) return [...addresses];
    const noMeter = myIdentifiers.filter((id) => classifyIdentifier(id) !== "meter");
    return noMeter.length > 0 ? [...noMeter] : [...myIdentifiers];
  }

  return [...myIdentifiers];
}
