import { readFile } from "node:fs/promises";
import OpenAI from "openai";
import { z } from "zod";
import {
  CATEGORY_DEDUCTIBLE_DEFAULTS,
  DEDUCTIBLE_STATUSES,
  EXPENSE_CATEGORIES,
  ExpenseCategoryLabels,
  PARTIAL_BUSINESS_CATEGORIES,
  type DeductibleStatus,
  type ExpenseCategory,
} from "./enums";
import { formatIdentifierHintsForPrompt } from "./identifierHints";
import { extractPdfText } from "./pdf";

export interface UserAiContext {
  selfEmployedType?: string | null;
  workFromHomePercent?: number | null;
  mainActivityDescription?: string | null;
  categoryDefaults?: Partial<Record<ExpenseCategory, number>> | null;
  myIdentifiers?: readonly string[] | null;
}

// Raw line item as parsed from the AI response. The richer LineItem
// (with `id`, `included`, `vatAssumed`) is constructed by the document
// processor in src/lib/documents.ts.
export interface RawAiLineItem {
  description: string;
  identifier: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  belongsToUser: boolean;
}

export interface AiAnalysis {
  documentDate: string | null;
  paymentDate: string | null;
  servicePeriodStart: string | null;
  servicePeriodEnd: string | null;
  vendorName: string | null;
  vendorRegistrationNumber: string | null;
  documentNumber: string | null;
  currency: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  category: ExpenseCategory;
  deductibleStatus: DeductibleStatus;
  deductiblePercent: number | null;
  deductibleAmount: number | null;
  confidenceScore: number;
  explanation: string;
  needsReviewReasons: string[];
  lineItems: RawAiLineItem[];
}

const numberOrNull = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const cleaned = v.replace(/\s/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  })
  .nullable();

const stringOrNull = z
  .union([z.string(), z.null()])
  .transform((v) => (v && typeof v === "string" ? v.trim() || null : null))
  .nullable();

const lineItemSchema = z.object({
  description: z.union([z.string(), z.null()]).transform((v) => (v ?? "").trim().slice(0, 200)),
  identifier: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => (v && typeof v === "string" ? v.trim().slice(0, 80) || null : null)),
  netAmount: numberOrNull,
  vatAmount: numberOrNull,
  totalAmount: numberOrNull,
  belongsToUser: z
    .union([z.boolean(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "string") return /^(true|1|yes)$/i.test(v.trim());
      return false;
    }),
});

const aiResponseSchema = z.object({
  documentDate: stringOrNull,
  paymentDate: stringOrNull,
  servicePeriodStart: stringOrNull,
  servicePeriodEnd: stringOrNull,
  vendorName: stringOrNull,
  vendorRegistrationNumber: stringOrNull,
  documentNumber: stringOrNull,
  currency: stringOrNull,
  netAmount: numberOrNull,
  vatAmount: numberOrNull,
  totalAmount: numberOrNull,
  category: z.string().transform((v) => v.toLowerCase().trim()),
  deductibleStatus: z.string().transform((v) => v.toLowerCase().trim()),
  deductiblePercent: numberOrNull,
  deductibleAmount: numberOrNull,
  confidenceScore: z
    .union([z.number(), z.string()])
    .transform((v) => {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(1, n));
    }),
  explanation: z.string().default(""),
  needsReviewReasons: z.array(z.string()).default([]),
  lineItems: z.array(lineItemSchema).default([]).optional(),
});

const LV_TAX_GUIDANCE = `Latvijas pašnodarbinātā (saimnieciskās darbības veicēja, IIN maksātāja) izdevumu pamatprincipi:
- Izdevums ir atskaitāms TIKAI tādā mērā, kādā tas ir saistīts ar saimniecisko darbību.
- Mājas birojam Latvijā vispārpieņemtā prakse:
  * Mājokļa īre — daļēji atskaitāma (~70%, ja mājoklis tiek izmantots arī kā birojs).
  * Elektrība, apkure, ūdens, komunālie — daļēji ~70%.
  * Internets un mobilais sakars — daļēji ~70%.
- Personiska auto degviela un transports — parasti 50%, ja nav atsevišķas darba braucienu uzskaites.
- Datortehnika personīgam + darba lietojumam — parasti ~70%.
- Profesionālie pakalpojumi, programmatūra, biroja preces, reklāma, bankas komisijas (saimnieciskās darbības kontam), apmācības, komandējumi — 100%, ja pirkums tieši saistīts ar darbu.
- Ēdināšana (Rimi, Maxima u.c.) — parasti netiek atskaitīta, izņemot komandējumu.

SVARĪGI: 
- Šie ir vispārpieņemti orientieri, NEVIS likuma teksts. Galīgo lēmumu pieņem pats lietotājs/grāmatvedis.
- Esi piesardzīgs. Ja nezini reālo izmantojumu — saglabā konservatīvo procentu un atzīmē needsReviewReasons.
- NEKAD nepiedāvā "yes 100%" kategorijām elektrība, īre, internets, telecom, degviela, transports, tehnika bez ļoti skaidra pierādījuma (piem., rēķins izrakstīts uz uzņēmuma nosaukuma, atsevišķs darba telpas adreses rēķins).`;

const SYSTEM_PROMPT = `Tu esi asistents ReceiptBox LV — rīkam, kas palīdz Latvijas pašnodarbinātajiem sagatavot izdevumus deklarācijai.
Analizē čekus, rēķinus, ekrānuzņēmumus un PDF dokumentus.

UZDEVUMS:
1. Izvelc tikai faktiskos datus no dokumenta. Neizdomā vērtības.
2. Klasificē izdevumu kategoriju.
3. Piešķir deductibleStatus un deductiblePercent saskaņā ar zemāk doto vadlīniju.
4. Esi piesardzīgs — labāk nenovērtēt par zemu nekā pārvērtēt.
5. Nesniedz juridiskas garantijas.

${LV_TAX_GUIDANCE}

VAIRĀKU POZĪCIJU RĒĶINI (svarīgi!):
- Ja rēķinā ir vairāki abonenti / telefona numuri (piem., LMT, Tele2, Bite),
  vairāki skaitītāji (piem., Latvenergo), vairākas adreses, vairāki pakalpojumi
  utt. — atgriez tos masīvā "lineItems". PDF ar vairākām lapām: OBLIGĀTI
  pārskati VISAS lapas (--- Lapa 2 --- u.c.) — adreses un summas bieži ir 2. lapā.
  Telekom (LMT u.c.): ikmēneša abonēšanas rindām liec netAmount = «Summa bez PVN»
  (piem. 11,55), nevis «Kopā ar PVN». totalAmount = net + PVN; ja redzams tikai
  kopā ar PVN — totalAmount = tas, netAmount atstā null (sistēma aprēķinās).
  Katrai pozīcijai norādi:
    * description — īss apraksts, piem., "Mobilais plāns Premium" vai
      "Skaitītājs Nr. 12345 — elektrība".
    * identifier — telefona numurs, IBAN, skaitītāja Nr., adrese (iela, mājas
      nr., dzīvoklis), klienta numurs vai cits tokens. Ja rēķinā ir vairākas
      adreses — katrai atsevišķa lineItem rinda ar pilnu adresi identifier
      laukā un/vai description. Ja nav — null.
    * netAmount, vatAmount, totalAmount — summas tieši šai pozīcijai.
    * belongsToUser — true, ja identifier sakrīt ar lietotāja sarakstā
      norādītajiem (skaties LIETOTĀJA KONTEKSTU). Citādi false.
- Ja rēķins ir vienas pozīcijas (parastākais gadījums — viens čeks no Maxima,
  viens benzīna čeks) — atgriez TUKŠU masīvu "lineItems": [].
- Top-level netAmount/vatAmount/totalAmount ir VISA dokumenta kopsumma.
  lineItems summas pieskaitās šai kopsummai (vai ir tuvu tai).
- Ja rēķinā ir vairākas adreses (Elektrum/Latvenergo/Enefit), lineItems ir OBLIGĀTI:
  katrai "Pieslēguma vieta" / adreses sadaļai atsevišķa rinda ar tās kopsummu,
  NEVIS visa rēķina kopsumma. Enefit: ņem "Kopā ar PVN" konkrētajai pieslēguma vietai.
  Elektrum: ņem "Kopā" bez PVN attiecīgajai adresei.

PVN APRĒĶINS:
- Ja redzami visi trīs (netAmount, vatAmount, totalAmount) — atgriez tos visus.
- Ja redzams TIKAI netAmount (vai tikai totalAmount), atgriez to. NEMĒĢINI pats
  aprēķināt trūkstošo — sistēma to izdarīs ar Latvijas standarta likmi 21%.
- Ja vendors ir mikrouzņēmumu nodokļa maksātājs vai bez PVN reģistra — atzīmē
  needsReviewReasons un atgriez vatAmount: 0.

VISPĀRĒJI NOTEIKUMI:
- Ja dati nav redzami, atgriez null.
- Datumus formatē kā YYYY-MM-DD.
- Atgriez TIKAI derīgu JSON objektu, bez papildu teksta.
- explanation lauks vienmēr ir latviešu valodā un īss (1-3 teikumi).
- needsReviewReasons ir īsi latviešu teicieni, piem. "Iespējams personīgs izdevums", "Pārbaudi darba telpas proporciju".`;

function buildUserContextSection(ctx: UserAiContext | null | undefined): string | null {
  if (!ctx) return null;
  const parts: string[] = [];
  if (ctx.selfEmployedType) {
    parts.push(`Pašnodarbinātā tips: ${ctx.selfEmployedType}`);
  }
  if (typeof ctx.workFromHomePercent === "number") {
    parts.push(`Darbs no mājām: ${ctx.workFromHomePercent}% laika`);
  }
  if (ctx.mainActivityDescription) {
    parts.push(`Galvenā darbība: ${ctx.mainActivityDescription}`);
  }
  if (ctx.categoryDefaults && Object.keys(ctx.categoryDefaults).length > 0) {
    const overrides = Object.entries(ctx.categoryDefaults)
      .map(([cat, pct]) => `${ExpenseCategoryLabels[cat as ExpenseCategory] ?? cat}: ${pct}%`)
      .join(", ");
    parts.push(`Lietotāja personīgie procenti: ${overrides}`);
  }
  parts.push(`Identifikatoru ceļvedis profilā: ${formatIdentifierHintsForPrompt()}`);
  if (ctx.myIdentifiers && ctx.myIdentifiers.length > 0) {
    parts.push(
      `Lietotāja identifikatori: ${ctx.myIdentifiers.join(", ")}. ` +
        `lineItems, kuru identifier vai description satur kādu no šiem, atzīmē belongsToUser=true; pārējās — false.`,
    );
  }
  if (parts.length === 0) return null;
  return [
    "LIETOTĀJA KONTEKSTS (izmanto, lai precizētu deductiblePercent un atfiltrētu lineItems):",
    ...parts.map((p) => `- ${p}`),
    "Ja lietotāja konteksts norāda konkrētu procentu vai darba režīmu, izmanto to, nevis vispārējo orientieri.",
  ].join("\n");
}

const USER_INSTRUCTION = `Atbildi STINGRI ar šādu JSON shēmu (visi lauki obligāti, izmanto null, ja nav datu):
{
  "documentDate": "YYYY-MM-DD vai null",
  "paymentDate": "YYYY-MM-DD vai null",
  "servicePeriodStart": "YYYY-MM-DD vai null",
  "servicePeriodEnd": "YYYY-MM-DD vai null",
  "vendorName": "string vai null",
  "vendorRegistrationNumber": "string vai null",
  "documentNumber": "string vai null",
  "currency": "EUR vai cita valūta vai null",
  "netAmount": number vai null,
  "vatAmount": number vai null,
  "totalAmount": number vai null,
  "category": "telecom | internet | electricity | rent | fuel | transport | office_supplies | software | hardware | professional_services | education | bank_fees | advertising | business_travel | food | mixed_personal_business | unknown",
  "deductibleStatus": "yes | partial | no | unknown",
  "deductiblePercent": number vai null,
  "deductibleAmount": number vai null,
  "confidenceScore": number no 0 līdz 1,
  "explanation": "īss skaidrojums latviešu valodā",
  "needsReviewReasons": ["īsi latviešu iemesli"],
  "lineItems": [
    {
      "description": "īss apraksts",
      "identifier": "telefona numurs / IBAN / skaitītāja Nr. / null",
      "netAmount": number vai null,
      "vatAmount": number vai null,
      "totalAmount": number vai null,
      "belongsToUser": true/false (true tikai ja identifier sakrīt ar lietotāja sarakstu)
    }
  ]
}
Ja dokuments ir vienas pozīcijas — lineItems: []. Ja vairāku pozīciju — uzskaiti visas.`;

const KNOWN_VENDORS: Array<{ match: RegExp; category: ExpenseCategory; vendor: string }> = [
  { match: /\b(lmt|tele2|bite|tet)\b/i, category: "telecom", vendor: "" },
  { match: /\b(latvenergo|elektrum)\b/i, category: "electricity", vendor: "" },
  { match: /\b(circle\s*k|neste|virši|virsi)\b/i, category: "fuel", vendor: "" },
  { match: /\bbolt\b/i, category: "transport", vendor: "Bolt" },
  { match: /\bairbaltic\b/i, category: "business_travel", vendor: "AirBaltic" },
  { match: /\b(rimi|maxima)\b/i, category: "food", vendor: "" },
  { match: /\b(depo|kurši|kursi|rd electronics|euronics)\b/i, category: "hardware", vendor: "" },
  { match: /\b(apple|google|microsoft|adobe|openai)\b/i, category: "software", vendor: "" },
];

function fallbackAnalysis(reason: string): AiAnalysis {
  return {
    documentDate: null,
    paymentDate: null,
    servicePeriodStart: null,
    servicePeriodEnd: null,
    vendorName: null,
    vendorRegistrationNumber: null,
    documentNumber: null,
    currency: null,
    netAmount: null,
    vatAmount: null,
    totalAmount: null,
    category: "unknown",
    deductibleStatus: "unknown",
    deductiblePercent: null,
    deductibleAmount: null,
    confidenceScore: 0,
    explanation: "Neizdevās automātiski analizēt dokumentu.",
    needsReviewReasons: [reason],
    lineItems: [],
  };
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeCategory(value: string): ExpenseCategory {
  const lower = value.toLowerCase().trim();
  if ((EXPENSE_CATEGORIES as readonly string[]).includes(lower)) {
    return lower as ExpenseCategory;
  }
  return "unknown";
}

function normalizeDeductible(value: string): DeductibleStatus {
  const lower = value.toLowerCase().trim();
  if ((DEDUCTIBLE_STATUSES as readonly string[]).includes(lower)) {
    return lower as DeductibleStatus;
  }
  return "unknown";
}

function applyDomainRules(a: AiAnalysis, ctx?: UserAiContext | null): AiAnalysis {
  const reasons = new Set(a.needsReviewReasons);
  let { deductibleStatus, deductiblePercent, deductibleAmount, category } = a;

  const def = CATEGORY_DEDUCTIBLE_DEFAULTS[category];
  const userOverride = ctx?.categoryDefaults?.[category];
  const desiredPercent = userOverride ?? def.percent;

  // 1) For categories that are partial-by-default, downgrade any AI "yes"
  // back to partial and force a manual review with the conservative default.
  if (
    deductibleStatus === "yes" &&
    PARTIAL_BUSINESS_CATEGORIES.includes(category)
  ) {
    deductibleStatus = "partial";
    deductiblePercent = desiredPercent;
    reasons.add(def.note);
    reasons.add(
      "AI bija ieteicis pilnu atskaitījumu — pazeminām līdz konservatīvai daļai. Pārbaudi, vai atbilst tavai situācijai.",
    );
  }

  // 2) Food category: AI must not claim "yes" by itself.
  if (category === "food" && deductibleStatus === "yes") {
    deductibleStatus = "no";
    deductiblePercent = 0;
    reasons.add(def.note);
  }

  // 3) For partial-by-default categories where AI did not set a percent,
  // fall back to the configured default.
  if (
    deductibleStatus === "partial" &&
    (deductiblePercent === null || deductiblePercent === undefined)
  ) {
    deductiblePercent = desiredPercent;
    reasons.add(def.note);
  }

  // 4) Sanity-check partial percentages.
  if (
    deductibleStatus === "partial" &&
    !PARTIAL_BUSINESS_CATEGORIES.includes(category) &&
    category !== "mixed_personal_business"
  ) {
    reasons.add("Daļējs atskaitījums neierastai kategorijai — jāpārbauda.");
  }

  // 5) "Clear business" yes — fill percent if AI omitted it.
  if (deductibleStatus === "yes") {
    deductiblePercent = deductiblePercent ?? 100;
  }

  // 6) Normalise no/unknown.
  if (deductibleStatus === "no") {
    deductiblePercent = 0;
    deductibleAmount = 0;
  }
  if (deductibleStatus === "unknown") {
    if (deductiblePercent !== 0) deductiblePercent = null;
    deductibleAmount = null;
  }

  // 7) Recompute deductibleAmount from totalAmount × percent.
  if (
    a.totalAmount !== null &&
    deductiblePercent !== null &&
    Number.isFinite(deductiblePercent)
  ) {
    deductibleAmount = Number(((a.totalAmount * deductiblePercent) / 100).toFixed(2));
  }

  return {
    ...a,
    category,
    deductibleStatus,
    deductiblePercent,
    deductibleAmount,
    needsReviewReasons: [...reasons],
  };
}

function applyVendorHeuristics(a: AiAnalysis): AiAnalysis {
  if (a.category !== "unknown") return a;
  if (!a.vendorName) return a;
  const lower = a.vendorName.toLowerCase();
  for (const v of KNOWN_VENDORS) {
    if (v.match.test(lower)) {
      return { ...a, category: v.category };
    }
  }
  return a;
}

function getClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

/**
 * OCR-style plain text from a utility bill photo (Enefit / Elektrum).
 * Used only for per-address splitting when PDF text is unavailable.
 */
export async function extractUtilityBillPlainText(
  filePath: string,
  mimeType: string,
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const lowerMime = (mimeType || "").toLowerCase();
  const lowerName = filePath.toLowerCase();
  const isImage =
    lowerMime.startsWith("image/") || /\.(png|jpe?g|webp)$/i.test(lowerName);
  const isPdf = lowerMime === "application/pdf" || lowerName.endsWith(".pdf");
  if (!isImage && !isPdf) return null;

  try {
    const buffer = await readFile(filePath);
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const systemText =
      "Extract ALL visible text from this Latvian electricity bill. " +
      "Include every 'Pieslēguma vieta' block, addresses, meter numbers (Skaitītājs), " +
      "and each 'Kopā ar PVN' / 'Kopā' amount. Output plain text only, preserve numbers.";

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = isPdf
      ? [
          {
            type: "file",
            file: {
              filename: lowerName.split("/").pop() ?? "bill.pdf",
              file_data: `data:application/pdf;base64,${buffer.toString("base64")}`,
            },
          } as OpenAI.Chat.Completions.ChatCompletionContentPart,
        ]
      : [
          {
            type: "image_url",
            image_url: {
              url: `data:${lowerMime.startsWith("image/") ? lowerMime : "image/jpeg"};base64,${buffer.toString("base64")}`,
            },
          },
        ];

    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: systemText },
        { role: "user", content: userContent },
      ],
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return text.length >= 40 ? text : null;
  } catch {
    return null;
  }
}

interface BuildUserContentResult {
  parts: OpenAI.Chat.Completions.ChatCompletionContentPart[];
  earlyFailure?: AiAnalysis;
}

export interface AnalyzeDocumentOptions {
  /** Reuse PDF text already extracted (same string used for utility heuristics). */
  preloadedPdfText?: string | null;
  preloadedPdfPageCount?: number;
}

async function buildUserContent(
  filePath: string,
  mimeType: string,
  originalFileName: string,
  opts?: AnalyzeDocumentOptions,
): Promise<BuildUserContentResult> {
  const lowerMime = (mimeType || "").toLowerCase();
  const lowerName = originalFileName.toLowerCase();
  const isImage = lowerMime.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/.test(lowerName);
  const isPdf = lowerMime === "application/pdf" || lowerName.endsWith(".pdf");

  const parts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: USER_INSTRUCTION },
    {
      type: "text",
      text: `Faila nosaukums: ${originalFileName}\nMIME: ${mimeType || "nezināms"}`,
    },
  ];

  if (isImage) {
    const buffer = await readFile(filePath);
    const base64 = buffer.toString("base64");
    const imageMime = lowerMime.startsWith("image/") ? lowerMime : "image/jpeg";
    parts.push({
      type: "image_url",
      image_url: {
        url: `data:${imageMime};base64,${base64}`,
      },
    });
    return { parts };
  }

  if (isPdf) {
    try {
      const preloaded = opts?.preloadedPdfText?.trim();
      if (preloaded && preloaded.length >= 20) {
        const pageCount = opts?.preloadedPdfPageCount ?? 1;
        parts.push({
          type: "text",
          text: `Šis ir PDF dokuments (${pageCount} lpp.). Tālāk ir izvilkts teksts. Analizē tikai šo saturu:\n\n${preloaded}`,
        });
        return { parts };
      }
      const pdf = await extractPdfText(filePath);
      if (!pdf.hasTextLayer) {
        return {
          parts,
          earlyFailure: fallbackAnalysis(
            "PDF dokumentā nav teksta slāņa (skanēts attēls). Lūdzu sūti dokumentu kā fotoattēlu (JPG/PNG).",
          ),
        };
      }
      parts.push({
        type: "text",
        text: `Šis ir PDF dokuments (${pdf.pageCount} lpp.). Tālāk ir izvilkts teksts. Analizē tikai šo saturu:\n\n${pdf.text}`,
      });
      return { parts };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message.slice(0, 160) : "Nezināma PDF kļūda.";
      return {
        parts,
        earlyFailure: fallbackAnalysis(`Neizdevās nolasīt PDF: ${reason}`),
      };
    }
  }

  parts.push({
    type: "text",
    text: "Šis dokuments nav attēls vai PDF — analizē tikai pēc faila nosaukuma un atgriez null, ja neesi drošs.",
  });
  return { parts };
}

export async function analyzeDocument(
  filePath: string,
  mimeType: string,
  originalFileName: string,
  userContext?: UserAiContext | null,
  opts?: AnalyzeDocumentOptions,
): Promise<AiAnalysis> {
  const client = getClient();
  if (!client) {
    return fallbackAnalysis("OPENAI_API_KEY nav konfigurēts.");
  }

  try {
    const built = await buildUserContent(filePath, mimeType, originalFileName, opts);
    if (built.earlyFailure) {
      return built.earlyFailure;
    }
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const systemMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];
    const ctxSection = buildUserContextSection(userContext);
    if (ctxSection) {
      systemMessages.push({ role: "system", content: ctxSection });
    }

    const completion = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        ...systemMessages,
        { role: "user", content: built.parts },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = safeJsonParse(raw);
    if (!parsed || typeof parsed !== "object") {
      return fallbackAnalysis("AI atgrieza nederīgu JSON.");
    }

    const validated = aiResponseSchema.safeParse(parsed);
    if (!validated.success) {
      return fallbackAnalysis("AI atbildē trūkst lauku.");
    }

    const data = validated.data;
    const analysis: AiAnalysis = {
      documentDate: data.documentDate,
      paymentDate: data.paymentDate,
      servicePeriodStart: data.servicePeriodStart,
      servicePeriodEnd: data.servicePeriodEnd,
      vendorName: data.vendorName,
      vendorRegistrationNumber: data.vendorRegistrationNumber,
      documentNumber: data.documentNumber,
      currency: data.currency,
      netAmount: data.netAmount,
      vatAmount: data.vatAmount,
      totalAmount: data.totalAmount,
      category: normalizeCategory(data.category),
      deductibleStatus: normalizeDeductible(data.deductibleStatus),
      deductiblePercent: data.deductiblePercent,
      deductibleAmount: data.deductibleAmount,
      confidenceScore: data.confidenceScore,
      explanation: (data.explanation || "").slice(0, 800),
      needsReviewReasons: data.needsReviewReasons
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 200))
        .slice(0, 10),
      lineItems: (data.lineItems ?? []).slice(0, 100).map((li) => ({
        description: li.description,
        identifier: li.identifier,
        netAmount: li.netAmount,
        vatAmount: li.vatAmount,
        totalAmount: li.totalAmount,
        belongsToUser: li.belongsToUser ?? false,
      })),
    };

    return applyDomainRules(applyVendorHeuristics(analysis), userContext);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.slice(0, 160) : "Nezināma AI kļūda.";
    return fallbackAnalysis(`AI kļūda: ${reason}`);
  }
}

export { applyDomainRules };

// ---------------------------------------------------------------------------
// Context-aware question answering for the "Konsultējies ar AI" panel.
// ---------------------------------------------------------------------------

export interface AskAiContext {
  user: UserAiContext | null;
  document: {
    vendorName: string | null;
    documentDate: string | null;
    category: ExpenseCategory | null;
    totalAmount: number | null;
    vatAmount: number | null;
    currency: string | null;
    deductibleStatus: DeductibleStatus | null;
    deductiblePercent: number | null;
    explanation: string | null;
  };
}

const ASK_SYSTEM_PROMPT = `Tu esi asistents ReceiptBox LV — palīdzi Latvijas pašnodarbinātajam pieņemt lēmumu par konkrētu izdevumu.
Atbildi vienmēr LATVIEŠU valodā. Esi konkrēts, īss (2-5 teikumi) un praktisks.
NEKAD nesniedz juridiskas garantijas. Vienmēr atgādini, ka galīgo lēmumu pieņem grāmatvedis / lietotājs pirms iesniegšanas VID.

${LV_TAX_GUIDANCE}

Atbildē iekļauj:
1. Skaidru ieteikumu (piem., "Šajā situācijā ~70% ir saprātīga proporcija").
2. Īsu pamatojumu.
3. Brīdinājumu, ja kaut kas nav skaidrs.`;

export async function answerUserQuestion(
  question: string,
  ctx: AskAiContext,
): Promise<{ answer: string; ok: boolean }> {
  const client = getClient();
  if (!client) {
    return {
      ok: false,
      answer: "AI nav konfigurēts (OPENAI_API_KEY trūkst). Konsultējies ar grāmatvedi.",
    };
  }

  const docLines: string[] = [];
  const d = ctx.document;
  if (d.vendorName) docLines.push(`Piegādātājs: ${d.vendorName}`);
  if (d.documentDate) docLines.push(`Datums: ${d.documentDate}`);
  if (d.category) {
    docLines.push(`Kategorija: ${ExpenseCategoryLabels[d.category] ?? d.category}`);
  }
  if (d.totalAmount !== null) {
    docLines.push(`Kopējā summa: ${d.totalAmount} ${d.currency ?? "EUR"}`);
  }
  if (d.vatAmount !== null) {
    docLines.push(`PVN: ${d.vatAmount} ${d.currency ?? "EUR"}`);
  }
  if (d.deductibleStatus) {
    docLines.push(
      `Pašreizējais atskaitāmais statuss: ${d.deductibleStatus}${
        d.deductiblePercent !== null ? ` (${d.deductiblePercent}%)` : ""
      }`,
    );
  }
  if (d.explanation) docLines.push(`AI iepriekšējais paskaidrojums: ${d.explanation}`);

  const userCtxSection = buildUserContextSection(ctx.user);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: ASK_SYSTEM_PROMPT },
  ];
  if (userCtxSection) messages.push({ role: "system", content: userCtxSection });
  messages.push({
    role: "user",
    content: [
      "DOKUMENTA KONTEKSTS:",
      ...docLines.map((l) => `- ${l}`),
      "",
      "LIETOTĀJA JAUTĀJUMS:",
      question.trim().slice(0, 1500),
    ].join("\n"),
  });

  try {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      messages,
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      return { ok: false, answer: "AI neatgriezīja atbildi. Pamēģini vēlreiz." };
    }
    return { ok: true, answer: raw.slice(0, 2000) };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message.slice(0, 200) : "Nezināma kļūda.";
    return { ok: false, answer: `AI kļūda: ${reason}` };
  }
}
