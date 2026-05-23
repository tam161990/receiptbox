import { prisma } from "./prisma";
import {
  analyzeDocument,
  extractUtilityBillPlainText,
  type AiAnalysis,
  type UserAiContext,
} from "./ai";
import { isTelecomVendor, normalizeTelecomLineItems } from "./telecomLineItems";
import { parseDateSafe } from "./dates";
import {
  isExpenseCategory,
  type ExpenseCategory,
  DocumentSourceLabels,
  isDocumentSourceType,
  type DocumentSourceType,
  DocumentStatus,
  DocumentStatusLabels,
  ExpenseCategoryLabels,
  DeductibleStatusLabels,
  isDeductibleStatus,
  isDocumentStatus,
  type DeductibleStatus,
  formatDocumentRetrievalLine,
  isDocumentRetrievalLocation,
  normalizeRetrievalLocation,
  type DocumentRetrievalLocation,
} from "./enums";
import { parseCategoryRetrievalDefaults } from "./categoryRetrievalDefaults";
import {
  attributedMoneyBreakdown,
  attributedTotal,
  inferVat,
  lineItemMatchesIdentifiers,
  parseLineItems,
  parseMyIdentifiers,
  type LineItem,
} from "./lineItems";
import { SensitiveDataCleaner } from "./sensitiveDataCleaner";
import { deleteUploadedFile } from "./storage";
import { extractPdfText } from "./pdf";
import { identifierHintLineForVendor, identifiersForUtilityVendor } from "./identifierHints";
import {
  buildUtilityLineItemsFromText,
  countKopaArPvnInText,
  getLastUtilityLineScanSummary,
  hasPerAddressUtilityFooters,
  heuristicResultMatchesDocument,
  isUtilityVendor,
  listSectionTotalsInText,
  parseAddressBlocksFromLines,
  pdfSuggestsMultipleAddresses,
  shouldApplyUtilityHeuristic,
  summarizeAddressBlocks,
  utilityTextForAddressSplit,
} from "./utilityBillHeuristic";
import {
  detectBankName,
  parseValstsBudzetsPayments,
  shouldApplyBankStatementHeuristic,
  classifyValstsBudzetsPayment,
  type BankStatementPayment,
} from "./bankStatementHeuristic";
import { resolveRetrievalForBankStatement } from "./uploadDefaults";

export interface DocumentReviewDecision {
  status: DocumentStatus;
  reasons: string[];
}

const MIN_CONFIDENCE = 0.7;

export function decideStatus(analysis: AiAnalysis): DocumentReviewDecision {
  const reasons = new Set(analysis.needsReviewReasons);
  let needsReview = false;

  if (!analysis.documentDate) {
    reasons.add("Nav norādīts dokumenta datums.");
    needsReview = true;
  }
  if (analysis.totalAmount === null || analysis.totalAmount === undefined) {
    reasons.add("Nav norādīta kopējā summa.");
    needsReview = true;
  }
  if (analysis.confidenceScore < MIN_CONFIDENCE) {
    reasons.add(`Pārliecības līmenis zems (${Math.round(analysis.confidenceScore * 100)}%).`);
    needsReview = true;
  }
  if (analysis.category === "unknown") {
    reasons.add("Kategorija nav noteikta.");
    needsReview = true;
  }
  if (analysis.deductibleStatus === "unknown") {
    needsReview = true;
  }

  return {
    status: needsReview ? "needs_review" : "processed",
    reasons: [...reasons],
  };
}

export function buildUserContext(user: {
  selfEmployedType: string | null;
  workFromHomePercent: number | null;
  mainActivityDescription: string | null;
  categoryDefaultsJson: string | null;
  myIdentifiersJson?: string | null;
}): UserAiContext {
  let categoryDefaults: Partial<Record<ExpenseCategory, number>> | null = null;
  if (user.categoryDefaultsJson) {
    try {
      const parsed = JSON.parse(user.categoryDefaultsJson) as unknown;
      if (parsed && typeof parsed === "object") {
        categoryDefaults = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (isExpenseCategory(k) && typeof v === "number" && v >= 0 && v <= 100) {
            categoryDefaults[k] = v;
          }
        }
      }
    } catch {
      categoryDefaults = null;
    }
  }
  return {
    selfEmployedType: user.selfEmployedType,
    workFromHomePercent: user.workFromHomePercent,
    mainActivityDescription: user.mainActivityDescription,
    categoryDefaults,
    myIdentifiers: parseMyIdentifiers(user.myIdentifiersJson),
  };
}

// Build the rich LineItem rows for storage from the AI's raw items + user
// identifiers + a generated id. Also runs VAT inference per line.
export function buildLineItemsFromAi(
  raw: AiAnalysis["lineItems"],
  myIdentifiers: readonly string[],
): LineItem[] {
  const out: LineItem[] = [];
  for (const r of raw) {
    const vat = inferVat({
      netAmount: r.netAmount,
      vatAmount: r.vatAmount,
      totalAmount: r.totalAmount,
    });
    const matches =
      myIdentifiers.length > 0
        ? lineItemMatchesIdentifiers(r.identifier, r.description, myIdentifiers)
        : r.belongsToUser;
    const belongs = myIdentifiers.length > 0 ? matches : r.belongsToUser;
    // Default-include policy: "smart" — if user has identifiers, include
    // only matching lines; if user has no identifiers, include all and let
    // the doc be flagged for review (handled later).
    const included = myIdentifiers.length > 0 ? matches : true;
    out.push({
      id: globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      description: r.description,
      identifier: r.identifier,
      netAmount: vat.netAmount,
      vatAmount: vat.vatAmount,
      totalAmount: vat.totalAmount,
      included,
      vatAssumed: vat.vatAssumed,
      belongsToUser: belongs,
    });
  }
  return out;
}

function sanitizeStoredLineItems(items: LineItem[]): LineItem[] {
  return items.map((it) => ({
    ...it,
    description: SensitiveDataCleaner.sanitizePlainText(it.description).slice(0, 200),
    identifier: SensitiveDataCleaner.sanitizeIdentifier(it.identifier),
  }));
}

/** Split utility bill by profile address identifiers; updates document amounts. */
export async function applyUtilityAddressSplit(
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { user: true },
  });
  if (!doc) return { ok: false, error: "Dokuments nav atrasts." };

  const myIdentifiers = parseMyIdentifiers(doc.user.myIdentifiersJson);
  if (myIdentifiers.length === 0) {
    const hint = identifierHintLineForVendor(doc.vendorName);
    return {
      ok: false,
      error: hint
        ? `Profilā nav identifikatoru. ${hint}`
        : "Profilā nav identifikatoru — skat. ceļvedi profilā (LMT, Latvenergo, Enefit).",
    };
  }

  const isPdf =
    (doc.mimeType || "").toLowerCase().includes("pdf") ||
    doc.originalFileName.toLowerCase().endsWith(".pdf");
  const isImage =
    (doc.mimeType || "").toLowerCase().startsWith("image/") ||
    /\.(png|jpe?g|webp)$/i.test(doc.originalFileName);

  let corpus = doc.rawExtractedText?.trim() ?? "";
  if (doc.storedFilePath && isPdf) {
    try {
      const pdf = await extractPdfText(doc.storedFilePath);
      corpus = pdf.text;
    } catch {
      /* keep stored corpus */
    }
  }
  if (!corpus && doc.storedFilePath && (isImage || isPdf)) {
    corpus = (await extractUtilityBillPlainText(doc.storedFilePath, doc.mimeType)) ?? "";
  }
  if (!corpus.trim()) {
    return {
      ok: false,
      error:
        "Nav teksta no rēķina. Augšupielādē PDF ar teksta slāni vai izmanto «Atkārtoti analizēt ar AI».",
    };
  }

  const utilityBill = shouldApplyUtilityHeuristic(
    doc.vendorName,
    doc.category,
    corpus,
  );

  if (!utilityBill) {
    return { ok: false, error: "Šis dokuments nav atpazīts kā elektrības rēķins." };
  }

  const invoiceGrand = doc.totalAmount;
  const parsedBlocks = parseAddressBlocksFromLines(corpus);
  const blockSummary = summarizeAddressBlocks(parsedBlocks);

  const heuristicItems = buildUtilityLineItemsFromText(
    corpus,
    myIdentifiers,
    doc.vendorName,
    invoiceGrand,
  );

  const reasons = new Set(parseReasons(doc.needsReviewReasons));
  const kopaN = countKopaArPvnInText(corpus);
  const lineScanSummary = getLastUtilityLineScanSummary();

  if (blockSummary) reasons.add(blockSummary);
  if (lineScanSummary && lineScanSummary !== blockSummary) {
    reasons.add(lineScanSummary);
  }

  if (heuristicItems.length === 0) {
    const vendorHint = identifierHintLineForVendor(doc.vendorName);
    reasons.add(
      `Neizdevās izvēlēties tavu adresi (${parsedBlocks.length} bloki, ${kopaN} «Kopā ar PVN»).` +
        (vendorHint ? ` Profilā: ${vendorHint}` : " Profilā: skat. identifikatoru tabulu."),
    );
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.NeedsReview,
        needsReviewReasons: JSON.stringify([...reasons].slice(0, 10)),
        rawExtractedText: SensitiveDataCleaner.sanitizeUtilityExtractText(corpus),
        totalAmount: null,
        netAmount: null,
        vatAmount: null,
        totalAmountAttributed: null,
        lineItemsJson: null,
      },
    });
    const hint = identifierHintLineForVendor(doc.vendorName);
    return {
      ok: false,
      error: hint
        ? `Adrese nav atrasta PDF tekstā. ${hint}`
        : "Adrese nav atrasta PDF tekstā — pārbaudi identifikatoru profilā.",
    };
  }

  const builtLineItems = buildLineItemsFromAi(heuristicItems, myIdentifiers);
  for (const item of builtLineItems) {
    item.included = true;
    item.belongsToUser = true;
  }
  const storedLineItems = sanitizeStoredLineItems(builtLineItems);
  const attrTotal = attributedTotal(storedLineItems);
  const attrBreakdown = attributedMoneyBreakdown(storedLineItems);

  if (
    invoiceGrand != null &&
    attrTotal != null &&
    Math.abs(attrTotal - invoiceGrand) <= Math.max(2, invoiceGrand * 0.01)
  ) {
    reasons.add(
      `Atrastā summa (${attrTotal.toFixed(2)} EUR) sakrīt ar visa rēķina kopsummu — izvēlēta nepareizā adrese. Pārbaudi identifikatoru profilā.`,
    );
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.NeedsReview,
        needsReviewReasons: JSON.stringify([...reasons].slice(0, 10)),
        rawExtractedText: SensitiveDataCleaner.sanitizeUtilityExtractText(corpus),
        totalAmount: null,
        netAmount: null,
        vatAmount: null,
        totalAmountAttributed: null,
        lineItemsJson: null,
      },
    });
    return {
      ok: false,
      error: "Summa sakrīt ar kopsummu rēķinā — izvēlies adresi manuāli vai labo profilu.",
    };
  }

  let deductibleAmount = doc.deductibleAmount;
  if (attrTotal !== null && doc.deductiblePercent !== null) {
    deductibleAmount = Number(((attrTotal * doc.deductiblePercent) / 100).toFixed(2));
  }

  const pickLabel = heuristicItems[0]?.description?.replace(/^[^:]+:\s*/, "") ?? "?";
  reasons.add(
    `Izvēlēta adrese: ${pickLabel} — ${attrTotal?.toFixed(2) ?? "?"} EUR (visa rēķina kopsumma: ${invoiceGrand?.toFixed(2) ?? "?"} EUR).`,
  );

  await prisma.document.update({
    where: { id: documentId },
    data: {
      lineItemsJson: JSON.stringify(storedLineItems),
      totalAmountAttributed: attrTotal,
      deductibleAmountAttributed: deductibleAmount,
      netAmount: attrBreakdown?.netAmount ?? null,
      vatAmount: attrBreakdown?.vatAmount ?? null,
      totalAmount: attrBreakdown?.totalAmount ?? attrTotal,
      status: DocumentStatus.NeedsReview,
      needsReviewReasons: JSON.stringify([...reasons].slice(0, 10)),
      rawExtractedText: SensitiveDataCleaner.sanitizeUtilityExtractText(corpus),
    },
  });
  return { ok: true };
}

/** Re-run address split from stored PDF text when the original file was deleted. */
export async function reapplyUtilityHeuristicOnly(documentId: string): Promise<void> {
  await applyUtilityAddressSplit(documentId);
}

export interface BankStatementUploadInput {
  userId: string;
  originalFileName: string;
  storedFilePath: string;
  mimeType: string;
  fileSize: number;
  retrievalLocation: string | null;
  retrievalCustomNote: string | null;
  pdfText: string;
  sourceType: DocumentSourceType;
  telegramFileId?: string | null;
}

export interface IngestUploadedFileInput {
  userId: string;
  originalFileName: string;
  storedFilePath: string;
  mimeType: string;
  fileSize: number;
  sourceType: DocumentSourceType;
  sourceHint?: string | null;
  telegramFileId?: string | null;
  retrievalLocation?: string | null;
  retrievalCustomNote?: string | null;
}

export type IngestUploadedFileResult =
  | { kind: "bank_statement"; documentIds: string[] }
  | { kind: "single"; documentId: string };

/** Shared upload path for web panel and Telegram bot. */
export async function ingestUploadedFile(
  input: IngestUploadedFileInput,
): Promise<IngestUploadedFileResult> {
  const isPdf =
    (input.mimeType || "").toLowerCase().includes("pdf") ||
    input.originalFileName.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    try {
      const pdf = await extractPdfText(input.storedFilePath);
      const bankDocIds = await tryProcessBankStatementUpload({
        userId: input.userId,
        originalFileName: input.originalFileName,
        storedFilePath: input.storedFilePath,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        retrievalLocation: input.retrievalLocation ?? null,
        retrievalCustomNote: input.retrievalCustomNote ?? null,
        pdfText: pdf.text,
        sourceType: input.sourceType,
        telegramFileId: input.telegramFileId ?? null,
      });
      if (bankDocIds && bankDocIds.length > 0) {
        return { kind: "bank_statement", documentIds: bankDocIds };
      }
    } catch {
      // Fall through to normal AI processing.
    }
  }

  const created = await prisma.document.create({
    data: {
      userId: input.userId,
      originalFileName: input.originalFileName,
      storedFilePath: input.storedFilePath,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      telegramFileId: input.telegramFileId ?? null,
      status: DocumentStatus.Uploaded,
      sourceType: input.sourceType,
      sourceHint: input.sourceHint ?? null,
      retrievalLocation: normalizeRetrievalLocation(input.retrievalLocation),
      retrievalCustomNote: input.retrievalCustomNote ?? null,
    },
  });

  await processAndStoreAnalysis(created.id);
  return { kind: "single", documentId: created.id };
}

/** Create one document per Valsts budžets payment from a bank statement PDF. */
export async function createDocumentsFromBankStatement(
  input: BankStatementUploadInput,
  payments: BankStatementPayment[],
): Promise<string[]> {
  const bankName = detectBankName(input.pdfText);
  const retrievalLocation = resolveRetrievalForBankStatement(
    input.retrievalLocation,
    input.retrievalCustomNote,
  );
  const ids: string[] = [];

  for (const payment of payments) {
    const taxMeta = classifyValstsBudzetsPayment(payment.details);
    const explanation = SensitiveDataCleaner.sanitizePlainText(
      `${taxMeta.explanationLine}. ${payment.details}`.trim(),
    ).slice(0, 500);
    const sourceHint =
      input.sourceType === "telegram"
        ? bankName
          ? `Telegram · bankas izdruka (${bankName})`
          : "Telegram · bankas konta izdruka"
        : bankName
          ? `Bankas izdruka (${bankName})`
          : "Bankas konta izdruka";

    const created = await prisma.document.create({
      data: {
        userId: input.userId,
        originalFileName: `${input.originalFileName} — ${payment.paymentNumber}`,
        storedFilePath: null,
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        telegramFileId: input.telegramFileId ?? null,
        status: DocumentStatus.Processed,
        sourceType: isDocumentSourceType(input.sourceType) ? input.sourceType : "web",
        sourceHint,
        retrievalLocation,
        retrievalCustomNote: input.retrievalCustomNote,
        documentDate: payment.paymentDate,
        paymentDate: payment.paymentDate,
        servicePeriodStart: taxMeta.servicePeriodStart,
        servicePeriodEnd: taxMeta.servicePeriodEnd,
        vendorName: payment.recipient,
        documentNumber: payment.paymentNumber,
        currency: payment.currency,
        netAmount: payment.amount,
        vatAmount: 0,
        totalAmount: payment.amount,
        category: taxMeta.category,
        deductibleStatus: "no",
        deductiblePercent: 0,
        deductibleAmount: 0,
        confidenceScore: 0.95,
        explanation,
        needsReviewReasons: JSON.stringify([]),
        aiJson: JSON.stringify({
          source: "bank_statement_heuristic",
          bankName,
          statementFile: input.originalFileName,
          payment,
          taxMeta,
        }),
        fileDeletedAt: new Date(),
      },
    });
    ids.push(created.id);
  }

  return ids;
}

/**
 * If PDF is a bank statement with Valsts budžets payments, create documents and delete the file.
 * Returns document ids, or null when normal AI processing should run.
 */
export async function tryProcessBankStatementUpload(
  input: BankStatementUploadInput,
): Promise<string[] | null> {
  if (!shouldApplyBankStatementHeuristic(input.pdfText)) return null;

  const payments = parseValstsBudzetsPayments(input.pdfText);
  if (payments.length === 0) return null;

  const ids = await createDocumentsFromBankStatement(input, payments);
  await deleteUploadedFile(input.storedFilePath);
  return ids;
}

export async function processAndStoreAnalysis(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    include: { user: true, userCategory: true },
  });
  if (!doc) return;

  await prisma.document.update({
    where: { id: documentId },
    data: { status: DocumentStatus.Processing },
  });

  try {
    if (!doc.storedFilePath) {
      if (
        doc.rawExtractedText?.trim() &&
        shouldApplyUtilityHeuristic(
          doc.vendorName,
          doc.category,
          doc.rawExtractedText,
        )
      ) {
        await reapplyUtilityHeuristicOnly(documentId);
        return;
      }
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.Failed,
          needsReviewReasons: JSON.stringify([
            "Oriģinālais fails nav pieejams — AI analīze nav iespējama.",
          ]),
        },
      });
      return;
    }

    const userContext = buildUserContext(doc.user);
    const myIdentifiers = userContext.myIdentifiers ?? [];

    const isPdf =
      (doc.mimeType || "").toLowerCase().includes("pdf") ||
      doc.originalFileName.toLowerCase().endsWith(".pdf");

    let pdfText: string | null = doc.rawExtractedText;
    let pdfPageCount = 0;
    if (isPdf && doc.storedFilePath) {
      try {
        const pdf = await extractPdfText(doc.storedFilePath);
        pdfText = pdf.text;
        pdfPageCount = pdf.pageCount;
      } catch {
        pdfText = doc.rawExtractedText;
      }
    }

    const analysis = await analyzeDocument(
      doc.storedFilePath,
      doc.mimeType,
      doc.originalFileName,
      userContext,
      {
        preloadedPdfText: pdfText,
        preloadedPdfPageCount: pdfPageCount || undefined,
      },
    );
    const scrubbed = SensitiveDataCleaner.sanitizeAiAnalysisForPersistence(analysis);
    const decision = decideStatus(analysis);

    // ----- Top-level VAT inference -----
    const inferredTop = inferVat({
      netAmount: analysis.netAmount,
      vatAmount: analysis.vatAmount,
      totalAmount: analysis.totalAmount,
    });
    let topVatAssumed = inferredTop.vatAssumed;

    // ----- Subcategory override -----
    let finalDeductibleStatus = analysis.deductibleStatus;
    let finalDeductiblePercent = analysis.deductiblePercent;
    let finalDeductibleAmount = analysis.deductibleAmount;
    let finalUserCategoryId: string | null = doc.userCategoryId ?? null;

    if (doc.userCategory) {
      if (doc.userCategory.parentCategory === analysis.category) {
        if (doc.userCategory.deductibleStatus) {
          finalDeductibleStatus =
            doc.userCategory.deductibleStatus as typeof finalDeductibleStatus;
        }
        if (doc.userCategory.deductiblePercent !== null) {
          finalDeductiblePercent = doc.userCategory.deductiblePercent;
        }
      } else {
        finalUserCategoryId = null;
      }
    }

    const previousLineItems = parseLineItems(doc.lineItemsJson);

    const utilityBill = shouldApplyUtilityHeuristic(
      analysis.vendorName,
      analysis.category,
      pdfText,
    );

    let heuristicCorpus = pdfText;
    const isImage =
      (doc.mimeType || "").toLowerCase().startsWith("image/") ||
      /\.(png|jpe?g|webp)$/i.test(doc.originalFileName);
    if (utilityBill && doc.storedFilePath) {
      const kopaN = heuristicCorpus ? countKopaArPvnInText(heuristicCorpus) : 0;
      const pdfHasAddressFooters = hasPerAddressUtilityFooters(pdfText);
      const sectionTotals = heuristicCorpus ? listSectionTotalsInText(heuristicCorpus) : [];
      const onlyGrandTotalInText =
        analysis.totalAmount != null &&
        sectionTotals.length > 0 &&
        sectionTotals.every((t) => Math.abs(t - analysis.totalAmount!) < 2.5);
      const needsVision =
        !heuristicCorpus?.trim() ||
        (!pdfHasAddressFooters && kopaN < 2) ||
        (onlyGrandTotalInText && !pdfHasAddressFooters);
      if (needsVision && (isImage || isPdf)) {
        const vision = await extractUtilityBillPlainText(
          doc.storedFilePath,
          doc.mimeType,
        );
        if (vision) {
          heuristicCorpus = heuristicCorpus
            ? `${heuristicCorpus}\n\n${vision}`
            : vision;
        }
      }
    }

    const utilitySplitCorpus = utilityTextForAddressSplit(pdfText, heuristicCorpus);

    let builtLineItems = buildLineItemsFromAi(analysis.lineItems, myIdentifiers);
    if (isTelecomVendor(analysis.vendorName)) {
      builtLineItems = normalizeTelecomLineItems(builtLineItems);
    }
    let usedUtilityHeuristic = false;
    if (myIdentifiers.length > 0 && utilitySplitCorpus.trim() && utilityBill) {
      const heuristicItems = buildUtilityLineItemsFromText(
        utilitySplitCorpus,
        myIdentifiers,
        analysis.vendorName,
        analysis.totalAmount,
      );
      const utilityIds = identifiersForUtilityVendor(myIdentifiers, analysis.vendorName);
      if (heuristicItems.length > 0) {
        const heuristicBuilt = buildLineItemsFromAi(heuristicItems, myIdentifiers);
        const heuristicAttr = attributedTotal(heuristicBuilt);
        const looksGrand =
          analysis.totalAmount != null &&
          heuristicAttr != null &&
          Math.abs(heuristicAttr - analysis.totalAmount) <=
            Math.max(2, analysis.totalAmount * 0.01);
        const matchesDoc =
          utilitySplitCorpus &&
          heuristicResultMatchesDocument(
            heuristicItems,
            utilitySplitCorpus,
            analysis.totalAmount,
            utilityIds,
          );
        if (!looksGrand && matchesDoc) {
          usedUtilityHeuristic = true;
          builtLineItems = heuristicBuilt;
          for (const item of builtLineItems) {
            item.included = true;
            item.belongsToUser = true;
          }
        }
      }
    }

    // Do not keep AI line items that are just the invoice grand total (e.g. 1045.29).
    if (
      utilityBill &&
      !usedUtilityHeuristic &&
      analysis.totalAmount != null &&
      builtLineItems.length > 0
    ) {
      const grand = analysis.totalAmount;
      builtLineItems = builtLineItems.filter(
        (i) =>
          i.totalAmount === null ||
          Math.abs(i.totalAmount - grand) > Math.max(2, grand * 0.01),
      );
    }

    let utilityHeuristicFailed = false;
    if (
      myIdentifiers.length > 0 &&
      heuristicCorpus?.trim() &&
      utilityBill &&
      !usedUtilityHeuristic &&
      (countKopaArPvnInText(heuristicCorpus) >= 2 ||
        pdfSuggestsMultipleAddresses(heuristicCorpus, myIdentifiers, pdfPageCount))
    ) {
      utilityHeuristicFailed = true;
    }

    if (previousLineItems.length > 0 && builtLineItems.length > 0 && !usedUtilityHeuristic) {
      // Only restore user's include/exclude toggles when AI returned the same rows.
      // Never reuse old line items from a prior vendor (e.g. Enefit on a Selectum bill).
      for (const item of builtLineItems) {
        const prior = previousLineItems.find(
          (p) =>
            p.description === item.description &&
            (p.identifier ?? "") === (item.identifier ?? "") &&
            Math.abs((p.totalAmount ?? 0) - (item.totalAmount ?? 0)) < 0.02,
        );
        if (prior) item.included = prior.included;
      }
    }

    const storedLineItems = sanitizeStoredLineItems(builtLineItems);

    const attrTotal = attributedTotal(storedLineItems);
    const attrBreakdown =
      storedLineItems.length > 0 ? attributedMoneyBreakdown(storedLineItems) : null;
    let attrDeductible: number | null = null;
    if (attrTotal !== null && finalDeductiblePercent !== null) {
      attrDeductible = Number(((attrTotal * finalDeductiblePercent) / 100).toFixed(2));
    }

    const grandTotal = analysis.totalAmount;
    const attrLooksLikePerAddress =
      !utilityBill ||
      grandTotal === null ||
      attrTotal === null ||
      attrTotal < grandTotal - Math.max(5, grandTotal * 0.05);

    if (
      attrBreakdown &&
      storedLineItems.some((i) => i.included) &&
      attrLooksLikePerAddress
    ) {
      inferredTop.netAmount = attrBreakdown.netAmount;
      inferredTop.vatAmount = attrBreakdown.vatAmount;
      inferredTop.totalAmount = attrBreakdown.totalAmount;
      topVatAssumed = storedLineItems.some((i) => i.included && i.vatAssumed);
    } else if (
      utilityBill &&
      myIdentifiers.length > 0 &&
      builtLineItems.length > 0 &&
      builtLineItems.every((i) => i.included)
    ) {
      const one = builtLineItems[0];
      if (one) {
        inferredTop.netAmount = one.netAmount;
        inferredTop.vatAmount = one.vatAmount;
        inferredTop.totalAmount = one.totalAmount ?? one.netAmount;
      }
    }

    const effectiveTotal = attrTotal ?? inferredTop.totalAmount;
    if (effectiveTotal !== null && finalDeductiblePercent !== null) {
      finalDeductibleAmount = Number(
        ((effectiveTotal * finalDeductiblePercent) / 100).toFixed(2),
      );
    } else if (finalDeductibleStatus === "no") {
      finalDeductibleAmount = 0;
    }

    const reasons = new Set(decision.reasons);
    if (
      utilityBill &&
      myIdentifiers.length > 0 &&
      analysis.totalAmount != null &&
      analysis.totalAmount > 100 &&
      !usedUtilityHeuristic &&
      !attrLooksLikePerAddress
    ) {
      reasons.add(
        `Rēķina kopsumma (${analysis.totalAmount.toFixed(2)} EUR) ir visticamāk par visām adresēm — automātiski neizdevās atrast tavu adresi. Pārbaudi pozīcijas vai identifikatorus profilā.`,
      );
      inferredTop.netAmount = attrBreakdown?.netAmount ?? null;
      inferredTop.vatAmount = attrBreakdown?.vatAmount ?? null;
      inferredTop.totalAmount = attrTotal;
    }
    if (utilityHeuristicFailed) {
      reasons.add(
        "Automātiski neizdevās atrast tavu adresi PDF tekstā. Profilā pievieno īsu identifikatoru (iela + dzīvoklis) vai skaitītāja numuru no tabulas. Pārbaudi pozīcijas manuāli.",
      );
    }
    if (topVatAssumed) {
      reasons.add(
        "PVN nav norādīts dokumentā — aprēķināts pēc Latvijas standarta likmes 21%. Pārbaudi.",
      );
    }
    if (storedLineItems.length > 0) {
      const matched = storedLineItems.filter((i) => i.belongsToUser).length;
      if (myIdentifiers.length === 0) {
        reasons.add(
          "Dokumentā ir vairākas pozīcijas — pievieno savus identifikatorus (telefonus, IBAN, skaitītājus) profilā, lai automātiski atfiltrētu darbam piederošās. Pagaidām ieskaitīts viss.",
        );
      } else if (matched === 0) {
        reasons.add(
          "Vairāku pozīciju rēķins, bet neviena pozīcija nesakrīt ar taviem identifikatoriem — pārbaudi manuāli.",
        );
      } else if (matched < storedLineItems.length) {
        reasons.add(
          `Vairāku pozīciju rēķins: ${matched} no ${storedLineItems.length} pozīcijām attiecas uz tevi. Pārbaudi atlasi.`,
        );
      }
      if (storedLineItems.some((i) => i.vatAssumed)) {
        reasons.add("Dažām pozīcijām PVN nav norādīts — aprēķināts pēc 21%.");
      }
    }
    let resolvedRetrieval: DocumentRetrievalLocation | null = normalizeRetrievalLocation(
      doc.retrievalLocation,
    );
    if (
      !resolvedRetrieval &&
      analysis.category &&
      analysis.category !== "unknown" &&
      isExpenseCategory(analysis.category)
    ) {
      const dmap = parseCategoryRetrievalDefaults(doc.user.categoryRetrievalDefaultsJson);
      resolvedRetrieval = dmap[analysis.category] ?? null;
    }

    if (!resolvedRetrieval) {
      reasons.add(
        "Norādi, kur vēlāk atrast šī dokumenta oriģinālu (e-pasts, operatora aplikācija, čeku mape u.tml.).",
      );
    }

    const includedLines = storedLineItems.filter((i) => i.included);
    if (utilityBill && myIdentifiers.length > 0) {
      if (storedLineItems.length === 0) {
        reasons.add(
          "Elektrības rēķins — nav izdevies sadalīt pa adresēm. Pārbaudi PDF 2. lapu un pozīcijas manuāli.",
        );
      } else if (includedLines.length === 0) {
        reasons.add(
          "Nav atlasīta neviena pozīcija tavai adresei — ieslēdz pareizo rindu vai labo identifikatoru profilā.",
        );
      }
      if (
        heuristicCorpus &&
        pdfSuggestsMultipleAddresses(heuristicCorpus, myIdentifiers, pdfPageCount) &&
        includedLines.length < 2 &&
        storedLineItems.length < 2
      ) {
        reasons.add(
          "Rēķinā, iespējams, vairākas adreses (vairākas PDF lapas) — pārbaudi, vai summa attiecas tikai uz tavu adresi.",
        );
      }
      const invoiceTotal = inferredTop.totalAmount;
      if (
        attrTotal !== null &&
        invoiceTotal !== null &&
        Math.abs(attrTotal - invoiceTotal) > 1.5
      ) {
        reasons.add(
          `Tavu adrešu pozīciju summa (${attrTotal.toFixed(2)} EUR) neatbilst rēķina kopsummai (${invoiceTotal.toFixed(2)} EUR) — pārbaudi.`,
        );
      }
      if (topVatAssumed || storedLineItems.some((i) => i.vatAssumed)) {
        reasons.add(
          "PVN aprēķināts automātiski (21%) — pārbaudi summu bez PVN un ar PVN pirms apstiprināšanas.",
        );
      }
    }

    let finalStatus =
      reasons.size > decision.reasons.length ? "needs_review" : decision.status;
    if (utilityBill && myIdentifiers.length > 0 && includedLines.length === 0) {
      finalStatus = DocumentStatus.NeedsReview;
    } else if (utilityBill && myIdentifiers.length > 0 && reasons.size > 0) {
      finalStatus = DocumentStatus.NeedsReview;
    }

    const sanitizedReasonStrings = [...reasons].map((r) =>
      SensitiveDataCleaner.sanitizePlainText(r).slice(0, 200),
    );

    const oldPath = doc.storedFilePath;

    await prisma.document.update({
      where: { id: documentId },
      data: {
        documentDate: parseDateSafe(analysis.documentDate),
        paymentDate: parseDateSafe(analysis.paymentDate),
        servicePeriodStart: parseDateSafe(analysis.servicePeriodStart),
        servicePeriodEnd: parseDateSafe(analysis.servicePeriodEnd),
        vendorName: scrubbed.vendorName,
        vendorRegistrationNumber: scrubbed.vendorRegistrationNumber,
        documentNumber: scrubbed.documentNumber,
        currency: analysis.currency || "EUR",
        netAmount: inferredTop.netAmount,
        vatAmount: inferredTop.vatAmount,
        totalAmount: inferredTop.totalAmount,
        category: analysis.category,
        deductibleStatus: finalDeductibleStatus,
        deductiblePercent: finalDeductiblePercent,
        deductibleAmount: finalDeductibleAmount,
        userCategoryId: finalUserCategoryId,
        lineItemsJson:
          storedLineItems.length > 0 ? JSON.stringify(storedLineItems) : null,
        totalAmountAttributed: attrTotal,
        deductibleAmountAttributed: attrDeductible,
        confidenceScore: analysis.confidenceScore,
        explanation: scrubbed.explanation,
        needsReviewReasons: JSON.stringify(sanitizedReasonStrings),
        aiJson: SensitiveDataCleaner.sanitizeAiJsonPayload(analysis),
        rawExtractedText:
          utilityBill && usedUtilityHeuristic && utilitySplitCorpus.trim()
            ? SensitiveDataCleaner.sanitizeUtilityExtractText(utilitySplitCorpus)
            : null,
        status: finalStatus,
        storedFilePath: null,
        fileDeletedAt: new Date(),
        retrievalLocation: resolvedRetrieval,
      },
    });

    if (oldPath) {
      const deletedOk = await deleteUploadedFile(oldPath);
      if (!deletedOk) {
        const fresh = await prisma.document.findUnique({ where: { id: documentId } });
        const merged = [
          ...parseReasons(fresh?.needsReviewReasons),
          "Brīdinājums: oriģinālais fails nav izdzēsts no servera diskā — sazinies ar atbalstu.",
        ];
        await prisma.document.update({
          where: { id: documentId },
          data: {
            needsReviewReasons: JSON.stringify(merged.map((r) => r.slice(0, 200))),
            status: DocumentStatus.NeedsReview,
          },
        });
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 200) : "Nezināma kļūda.";
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.Failed,
        needsReviewReasons: JSON.stringify([`Apstrādes kļūda: ${message}`]),
      },
    });
  }
}

export interface SerializedDocument {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
  updatedAt: string;
  status: DocumentStatus;
  statusLabel: string;
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
  /** Bez PVN / PVN / Kopā shown in UI when pozīcijas drive the slice (included lines). */
  effectiveNetAmount: number | null;
  effectiveVatAmount: number | null;
  category: ExpenseCategory | null;
  categoryLabel: string | null;
  deductibleStatus: DeductibleStatus | null;
  deductibleStatusLabel: string | null;
  deductiblePercent: number | null;
  deductibleAmount: number | null;
  userCategoryId: string | null;
  userCategoryName: string | null;
  // Line items (multi-position invoices). Empty array for simple receipts.
  lineItems: LineItem[];
  // Sum of totalAmount over included line items, or null when not applicable.
  totalAmountAttributed: number | null;
  deductibleAmountAttributed: number | null;
  // The total used in reports/exports: attributed if present, else top-level.
  effectiveTotalAmount: number | null;
  effectiveDeductibleAmount: number | null;
  confidenceScore: number | null;
  explanation: string | null;
  needsReviewReasons: string[];
  sourceType: DocumentSourceType;
  sourceTypeLabel: string;
  sourceHint: string | null;
  userSourceNote: string | null;
  retrievalLocation: DocumentRetrievalLocation | null;
  retrievalCustomNote: string | null;
  /** Combined hint for exports / lists (“Elektrum aplikācija”, “Cits: …”). */
  retrievalDisplayLine: string | null;
  /** ISO timestamp when the binary original was removed after extraction. */
  originalFileDeletedAt: string | null;
  /** Whether the AI can re-read the file from disk (false after privacy deletion). */
  canReanalyzeWithAi: boolean;
  /** Can run per-address utility split (PDF text or stored extract). */
  canUtilityAddressSplit: boolean;
}

/** After the user saves edits, drop resolved auto-flags and promote to processed when safe. */
export function recomputeDocumentStatusAfterUserEdit(
  doc: {
    status: string;
    documentDate: Date | null;
    totalAmount: number | null;
    totalAmountAttributed: number | null;
    category: string | null;
    deductibleStatus: string | null;
    retrievalLocation: string | null;
    needsReviewReasons: string | null;
    lineItemsJson: string | null;
  },
  opts: { userConfirmedReview?: boolean } = {},
): { status: DocumentStatus; needsReviewReasons: string[] } {
  const lineItems = parseLineItems(doc.lineItemsJson);
  const effectiveTotal = doc.totalAmountAttributed ?? doc.totalAmount;

  let reasons: string[] = [];
  if (opts.userConfirmedReview) {
    reasons = [];
  } else {
    reasons = parseReasons(doc.needsReviewReasons).filter((r) => {
      const lower = r.toLowerCase();
      if (
        lower.includes("kur vēlāk atrast") ||
        lower.includes("oriģinālu (e-pasts") ||
        (lower.includes("identifikator") && lower.includes("profilā"))
      ) {
        return false;
      }
      if (lower.includes("vairāku pozīciju") && lower.includes("pārbaudi")) {
        return false;
      }
      if (lower.includes("neviena pozīcija nesakrīt")) {
        return false;
      }
      if (lower.includes("pvn nav norādīts") || lower.includes("aprēķināts pēc 21")) {
        return false;
      }
      if (lower.includes("pārliecības līmenis")) return false;
      if (lower.includes("latvenergo") || lower.includes("adres")) return false;
      return true;
    });
  }

  const blocking: string[] = [];
  if (!doc.documentDate) blocking.push("Nav norādīts dokumenta datums.");
  if (effectiveTotal === null || effectiveTotal === undefined) {
    blocking.push("Nav norādīta kopējā summa.");
  }

  if (lineItems.length > 0) {
    const included = lineItems.filter((i) => i.included);
    if (included.length === 0) {
      blocking.push("Nav atlasīta neviena pozīcija — ieslēdz vismaz vienu rindu.");
    }
  }

  if (!opts.userConfirmedReview) {
    if (!doc.category || doc.category === "unknown") blocking.push("Kategorija nav noteikta.");
    if (!doc.deductibleStatus || doc.deductibleStatus === "unknown") {
      blocking.push("Atskaitāmības statuss nav noteikts.");
    }
    if (!doc.retrievalLocation) {
      blocking.push(
        "Norādi, kur vēlāk atrast šī dokumenta oriģinālu (e-pasts, operatora aplikācija, čeku mape u.tml.).",
      );
    }
  }

  const merged = opts.userConfirmedReview
    ? blocking
    : [...new Set([...reasons, ...blocking])];

  if (merged.length === 0) {
    return { status: DocumentStatus.Processed, needsReviewReasons: [] };
  }
  return { status: DocumentStatus.NeedsReview, needsReviewReasons: merged };
}

export function parseReasons(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((s): s is string => typeof s === "string");
    }
    return [];
  } catch {
    return [];
  }
}

type DocumentRow = {
  id: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: Date;
  updatedAt: Date;
  status: string;
  documentDate: Date | null;
  paymentDate: Date | null;
  servicePeriodStart: Date | null;
  servicePeriodEnd: Date | null;
  vendorName: string | null;
  vendorRegistrationNumber: string | null;
  documentNumber: string | null;
  currency: string | null;
  netAmount: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  category: string | null;
  deductibleStatus: string | null;
  deductiblePercent: number | null;
  deductibleAmount: number | null;
  confidenceScore: number | null;
  explanation: string | null;
  needsReviewReasons: string | null;
  userCategoryId?: string | null;
  userCategory?: { id: string; name: string } | null;
  lineItemsJson?: string | null;
  totalAmountAttributed?: number | null;
  deductibleAmountAttributed?: number | null;
  storedFilePath?: string | null;
  sourceType?: string | null;
  sourceHint?: string | null;
  userSourceNote?: string | null;
  fileDeletedAt?: Date | null;
  rawExtractedText?: string | null;
  retrievalLocation?: string | null;
  retrievalCustomNote?: string | null;
};

export interface SerializeOptions {
  customLabels?: Partial<Record<ExpenseCategory, string>>;
}

export function serializeDocument(
  doc: DocumentRow,
  opts: SerializeOptions = {},
): SerializedDocument {
  const status: DocumentStatus = isDocumentStatus(doc.status) ? doc.status : "uploaded";
  const category = isExpenseCategory(doc.category) ? doc.category : null;
  const deductibleStatus = isDeductibleStatus(doc.deductibleStatus) ? doc.deductibleStatus : null;
  const customLabels = opts.customLabels ?? {};
  const lineItems = parseLineItems(doc.lineItemsJson);
  const totalAmountAttributed = doc.totalAmountAttributed ?? null;
  const deductibleAmountAttributed = doc.deductibleAmountAttributed ?? null;

  const attrMoney =
    lineItems.length > 0 && lineItems.some((i) => i.included)
      ? attributedMoneyBreakdown(lineItems)
      : null;
  const effectiveNetAmount =
    attrMoney !== null ? attrMoney.netAmount : doc.netAmount;
  const effectiveVatAmount =
    attrMoney !== null ? attrMoney.vatAmount : doc.vatAmount;
  const effectiveTotalAmount =
    attrMoney?.totalAmount ?? totalAmountAttributed ?? doc.totalAmount;

  const sourceType: DocumentSourceType = isDocumentSourceType(doc.sourceType ?? "")
    ? (doc.sourceType as DocumentSourceType)
    : "unknown";

  const retrievalLocation: DocumentRetrievalLocation | null = normalizeRetrievalLocation(
    doc.retrievalLocation,
  );

  return {
    id: doc.id,
    originalFileName: doc.originalFileName,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
    uploadedAt: doc.uploadedAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    status,
    statusLabel: DocumentStatusLabels[status],
    documentDate: doc.documentDate ? doc.documentDate.toISOString() : null,
    paymentDate: doc.paymentDate ? doc.paymentDate.toISOString() : null,
    servicePeriodStart: doc.servicePeriodStart ? doc.servicePeriodStart.toISOString() : null,
    servicePeriodEnd: doc.servicePeriodEnd ? doc.servicePeriodEnd.toISOString() : null,
    vendorName: doc.vendorName,
    vendorRegistrationNumber: doc.vendorRegistrationNumber,
    documentNumber: doc.documentNumber,
    currency: doc.currency,
    netAmount: doc.netAmount,
    vatAmount: doc.vatAmount,
    totalAmount: doc.totalAmount,
    effectiveNetAmount,
    effectiveVatAmount,
    category,
    categoryLabel: category
      ? customLabels[category] ?? ExpenseCategoryLabels[category]
      : null,
    deductibleStatus,
    deductibleStatusLabel: deductibleStatus ? DeductibleStatusLabels[deductibleStatus] : null,
    deductiblePercent: doc.deductiblePercent,
    deductibleAmount: doc.deductibleAmount,
    userCategoryId: doc.userCategoryId ?? doc.userCategory?.id ?? null,
    userCategoryName: doc.userCategory?.name ?? null,
    lineItems,
    totalAmountAttributed,
    deductibleAmountAttributed,
    effectiveTotalAmount,
    effectiveDeductibleAmount: deductibleAmountAttributed ?? doc.deductibleAmount,
    confidenceScore: doc.confidenceScore,
    explanation: doc.explanation,
    needsReviewReasons: parseReasons(doc.needsReviewReasons),
    sourceType,
    sourceTypeLabel: DocumentSourceLabels[sourceType],
    sourceHint: doc.sourceHint ?? null,
    userSourceNote: doc.userSourceNote ?? null,
    retrievalLocation,
    retrievalCustomNote: doc.retrievalCustomNote ?? null,
    retrievalDisplayLine: formatDocumentRetrievalLine(retrievalLocation, doc.retrievalCustomNote),
    originalFileDeletedAt: doc.fileDeletedAt ? doc.fileDeletedAt.toISOString() : null,
    canReanalyzeWithAi: Boolean(doc.storedFilePath || doc.rawExtractedText),
    canUtilityAddressSplit:
      shouldApplyUtilityHeuristic(
        doc.vendorName,
        category,
        doc.rawExtractedText,
      ) ||
      (Boolean(doc.storedFilePath) &&
        (category === "electricity" || isUtilityVendor(doc.vendorName))),
  };
}
