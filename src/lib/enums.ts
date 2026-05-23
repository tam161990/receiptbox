// Domain enums and Latvian labels for ReceiptBox LV.
// SQLite does not support native Prisma enums, so we enforce values here.

export const DocumentStatus = {
  Uploaded: "uploaded",
  Processing: "processing",
  Processed: "processed",
  Failed: "failed",
  NeedsReview: "needs_review",
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const DOCUMENT_STATUSES: DocumentStatus[] = [
  "uploaded",
  "processing",
  "processed",
  "failed",
  "needs_review",
];

export const DocumentStatusLabels: Record<DocumentStatus, string> = {
  uploaded: "Augšupielādēts",
  processing: "Apstrādē",
  processed: "Apstrādāts",
  failed: "Kļūda",
  needs_review: "Jāpārbauda",
};

export const ExpenseCategory = {
  Telecom: "telecom",
  Internet: "internet",
  Electricity: "electricity",
  Rent: "rent",
  Fuel: "fuel",
  Transport: "transport",
  OfficeSupplies: "office_supplies",
  Software: "software",
  Hardware: "hardware",
  ProfessionalServices: "professional_services",
  Education: "education",
  BankFees: "bank_fees",
  Taxes: "taxes",
  Advertising: "advertising",
  BusinessTravel: "business_travel",
  Food: "food",
  MixedPersonalBusiness: "mixed_personal_business",
  Unknown: "unknown",
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "telecom",
  "internet",
  "electricity",
  "rent",
  "fuel",
  "transport",
  "office_supplies",
  "software",
  "hardware",
  "professional_services",
  "education",
  "bank_fees",
  "taxes",
  "advertising",
  "business_travel",
  "food",
  "mixed_personal_business",
  "unknown",
];

export const ExpenseCategoryLabels: Record<ExpenseCategory, string> = {
  telecom: "Telekomunikācijas",
  internet: "Internets",
  electricity: "Elektrība",
  rent: "Telpu noma",
  fuel: "Degviela",
  transport: "Transports",
  office_supplies: "Biroja preces",
  software: "Programmatūra",
  hardware: "Tehnika",
  professional_services: "Profesionālie pakalpojumi",
  education: "Apmācības",
  bank_fees: "Bankas komisijas",
  taxes: "Nodokļi",
  advertising: "Reklāma",
  business_travel: "Komandējumi / darba braucieni",
  food: "Ēdināšana",
  mixed_personal_business: "Jaukts personīgs/darba izdevums",
  unknown: "Nezināms",
};

export const DeductibleStatus = {
  Yes: "yes",
  Partial: "partial",
  No: "no",
  Unknown: "unknown",
} as const;
export type DeductibleStatus = (typeof DeductibleStatus)[keyof typeof DeductibleStatus];

export const DEDUCTIBLE_STATUSES: DeductibleStatus[] = ["yes", "partial", "no", "unknown"];

export const DeductibleStatusLabels: Record<DeductibleStatus, string> = {
  yes: "Atskaitāms",
  partial: "Daļēji atskaitāms",
  no: "Nav atskaitāms",
  unknown: "Jāpārbauda",
};

export type Quarter = "Q1" | "Q2" | "Q3" | "Q4" | "ALL";

export const DOCUMENT_SOURCE_TYPES = ["web", "telegram", "unknown"] as const;
export type DocumentSourceType = (typeof DOCUMENT_SOURCE_TYPES)[number];

export const DocumentSourceLabels: Record<DocumentSourceType, string> = {
  web: "Vadības panelis",
  telegram: "Telegram bots",
  unknown: "Nezināms",
};

export function isDocumentSourceType(v: string): v is DocumentSourceType {
  return (DOCUMENT_SOURCE_TYPES as readonly string[]).includes(v);
}

/** Where the user usually finds the original invoice/receipt later (privacy — we delete binaries). */
export const DOCUMENT_RETRIEVAL_LOCATIONS = [
  "email",
  "app",
  "internetbank",
  "receipt_folder",
  "whatsapp",
  "downloads",
  "other",
] as const;
export type DocumentRetrievalLocation =
  (typeof DOCUMENT_RETRIEVAL_LOCATIONS)[number];

/** Old DB/profile values → current codes. */
const LEGACY_RETRIEVAL_ALIASES: Record<string, DocumentRetrievalLocation> = {
  gmail: "email",
  elektrum_app: "app",
  telecom_app: "app",
};

export const DocumentRetrievalLabels: Record<DocumentRetrievalLocation, string> =
  {
    email: "E-pasts",
    app: "Aplikācija",
    internetbank: "Internetbanka",
    receipt_folder: "Čeku mape",
    whatsapp: "WhatsApp",
    downloads: "Lejupielādes",
    other: "Cits",
  };

export function normalizeRetrievalLocation(
  v: string | null | undefined,
): DocumentRetrievalLocation | null {
  if (!v || typeof v !== "string") return null;
  const trimmed = v.trim();
  if ((DOCUMENT_RETRIEVAL_LOCATIONS as readonly string[]).includes(trimmed)) {
    return trimmed as DocumentRetrievalLocation;
  }
  return LEGACY_RETRIEVAL_ALIASES[trimmed] ?? null;
}

export function isDocumentRetrievalLocation(v: string): v is DocumentRetrievalLocation {
  return (DOCUMENT_RETRIEVAL_LOCATIONS as readonly string[]).includes(v);
}

/** Accepts current codes and legacy aliases (for API / DB reads). */
export function isKnownRetrievalLocation(v: string): boolean {
  return normalizeRetrievalLocation(v) !== null;
}

export function formatDocumentRetrievalLine(
  location: DocumentRetrievalLocation | string | null | undefined,
  customNote: string | null | undefined,
): string | null {
  const canonical = normalizeRetrievalLocation(
    typeof location === "string" ? location : location ?? null,
  );
  if (!canonical) {
    const note = customNote?.trim();
    return note ? note : null;
  }
  const label = DocumentRetrievalLabels[canonical];
  if (canonical === "other") {
    const note = customNote?.trim();
    return note ? `${label}: ${note}` : label;
  }
  return label;
}

export const QUARTER_LABELS: Record<Quarter, string> = {
  Q1: "Q1 (jan–mar)",
  Q2: "Q2 (apr–jūn)",
  Q3: "Q3 (jūl–sep)",
  Q4: "Q4 (okt–dec)",
  ALL: "Viss gads",
};

// Categories where "yes" deductible can be reasonable when business relevance is clear.
export const CLEAR_BUSINESS_CATEGORIES: ExpenseCategory[] = [
  "software",
  "office_supplies",
  "professional_services",
  "bank_fees",
  "advertising",
  "business_travel",
  "education",
];

// Categories where mixed personal/business use is likely → partial by default.
export const PARTIAL_BUSINESS_CATEGORIES: ExpenseCategory[] = [
  "fuel",
  "rent",
  "electricity",
  "telecom",
  "internet",
  "transport",
  "hardware",
];

// Conservative defaults for Latvian self-employed working from home.
// These are applied when the user has not customised them in their profile.
// The philosophy: it is better to under-claim than over-claim — the user
// always sees the document in "Jāpārbauda" and can raise the percent if
// their real situation supports it.
export interface DeductibleDefault {
  status: DeductibleStatus;
  percent: number | null;
  note: string; // Latvian explanation shown to the user.
}

export const CATEGORY_DEDUCTIBLE_DEFAULTS: Record<ExpenseCategory, DeductibleDefault> = {
  telecom: {
    status: "partial",
    percent: 70,
    note: "Mobilā/fiksētā telefona izdevumi parasti daļēji — vidēji ~70%.",
  },
  internet: {
    status: "partial",
    percent: 70,
    note: "Mājas internets ir daļēji atskaitāms, vispārpieņemta proporcija ~70%.",
  },
  electricity: {
    status: "partial",
    percent: 70,
    note: "Elektrība mājas birojam: praksē ~70% saimnieciskās darbības daļa.",
  },
  rent: {
    status: "partial",
    percent: 70,
    note: "Mājokļa īre, ja izmantots arī kā birojs: parasti ~70%.",
  },
  fuel: {
    status: "partial",
    percent: 50,
    note: "Degviela bez atsevišķas darba braucienu uzskaites — parasti 50%.",
  },
  transport: {
    status: "partial",
    percent: 50,
    note: "Personīgais transports/taksometri — parasti 50%, ja nav atsevišķas uzskaites.",
  },
  hardware: {
    status: "partial",
    percent: 70,
    note: "Datortehnika, kas tiek izmantota arī personīgi — parasti ~70%.",
  },
  office_supplies: {
    status: "yes",
    percent: 100,
    note: "Biroja preces darbam — pilnībā atskaitāmas.",
  },
  software: {
    status: "yes",
    percent: 100,
    note: "Programmatūra darbam — pilnībā atskaitāma.",
  },
  professional_services: {
    status: "yes",
    percent: 100,
    note: "Profesionālie pakalpojumi (juristi, grāmatveži) — pilnībā atskaitāmi.",
  },
  advertising: {
    status: "yes",
    percent: 100,
    note: "Reklāma saimnieciskajai darbībai — pilnībā atskaitāma.",
  },
  bank_fees: {
    status: "yes",
    percent: 100,
    note: "Bankas komisijas saimnieciskās darbības kontam — pilnībā atskaitāmas.",
  },
  taxes: {
    status: "no",
    percent: 0,
    note: "Valsts nodokļu maksājumi (IIN, VSAOI u.c.) nav saimnieciskā izdevuma atskaitījums.",
  },
  business_travel: {
    status: "yes",
    percent: 100,
    note: "Darba braucieni un komandējumi — pilnībā atskaitāmi.",
  },
  education: {
    status: "yes",
    percent: 100,
    note: "Apmācības, kas saistītas ar profesionālo darbību — pilnībā atskaitāmas.",
  },
  food: {
    status: "no",
    percent: 0,
    note: "Pārtikas izdevumi parasti nav atskaitāmi (izņēmums — komandējumi).",
  },
  mixed_personal_business: {
    status: "partial",
    percent: 50,
    note: "Jaukts izdevums — pēc noklusējuma 50%, lūdzu precizē.",
  },
  unknown: {
    status: "unknown",
    percent: null,
    note: "Kategorija nav noteikta — jāpārbauda manuāli.",
  },
};

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
}

export function isDeductibleStatus(value: unknown): value is DeductibleStatus {
  return typeof value === "string" && DEDUCTIBLE_STATUSES.includes(value as DeductibleStatus);
}

export function isDocumentStatus(value: unknown): value is DocumentStatus {
  return typeof value === "string" && DOCUMENT_STATUSES.includes(value as DocumentStatus);
}
