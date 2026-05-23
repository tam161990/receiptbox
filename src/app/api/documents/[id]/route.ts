import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { parseDateSafe } from "@/lib/dates";
import {
  recomputeDocumentStatusAfterUserEdit,
  serializeDocument,
} from "@/lib/documents";
import { SensitiveDataCleaner } from "@/lib/sensitiveDataCleaner";
import {
  DEDUCTIBLE_STATUSES,
  DOCUMENT_STATUSES,
  EXPENSE_CATEGORIES,
  isDocumentRetrievalLocation,
  isExpenseCategory,
  isKnownRetrievalLocation,
  normalizeRetrievalLocation,
} from "@/lib/enums";
import { attributedTotal, parseLineItems, reconcileVat } from "@/lib/lineItems";
import { deleteUploadedFile } from "@/lib/storage";
import {
  parseCategoryRetrievalDefaults,
  serializeCategoryRetrievalDefaults,
} from "@/lib/categoryRetrievalDefaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionalStringDate = z.union([z.string(), z.null()]).optional();

const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  });

const optionalString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === null ? null : v.trim() || null));

const patchSchema = z.object({
  documentDate: optionalStringDate,
  paymentDate: optionalStringDate,
  servicePeriodStart: optionalStringDate,
  servicePeriodEnd: optionalStringDate,
  vendorName: optionalString,
  vendorRegistrationNumber: optionalString,
  documentNumber: optionalString,
  currency: optionalString,
  netAmount: optionalNumber,
  vatAmount: optionalNumber,
  totalAmount: optionalNumber,
  category: z.enum(EXPENSE_CATEGORIES as [string, ...string[]]).optional(),
  deductibleStatus: z.enum(DEDUCTIBLE_STATUSES as [string, ...string[]]).optional(),
  deductiblePercent: optionalNumber,
  deductibleAmount: optionalNumber,
  userCategoryId: z.union([z.string(), z.null()]).optional(),
  // PATCH `lineItems` accepts per-row updates by id. Each entry may carry
  // a new `included` flag and/or new net/vat/total amounts. Anything not
  // sent is left as-is. Pass `null` to clear all line items (useful when
  // the AI's split was wrong and the user wants top-level numbers to win).
  lineItems: z
    .union([
      z.array(
        z.object({
          id: z.string(),
          included: z.boolean().optional(),
          netAmount: optionalNumber,
          vatAmount: optionalNumber,
          totalAmount: optionalNumber,
        }),
      ),
      z.null(),
    ])
    .optional(),
  explanation: optionalString,
  userSourceNote: optionalString,
  retrievalLocation: z.union([z.string(), z.null()]).optional(),
  retrievalCustomNote: optionalString,
  /** When true, merges retrievalLocation into the user's per-category defaults for this doc's category. */
  saveRetrievalDefaultForCategory: z.boolean().optional(),
  /** User finished manual review — mark as Apstrādāts when required fields are present. */
  userConfirmedReview: z.boolean().optional(),
  status: z.enum(DOCUMENT_STATUSES as [string, ...string[]]).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
    include: { userCategory: true },
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, document: serializeDocument(doc) });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Nederīgi dati", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  const d = parsed.data;

  const dateFields = [
    "documentDate",
    "paymentDate",
    "servicePeriodStart",
    "servicePeriodEnd",
  ] as const;
  for (const f of dateFields) {
    if (d[f] !== undefined) {
      data[f] = d[f] === null ? null : parseDateSafe(d[f]);
    }
  }

  const stringFields = [
    "vendorName",
    "vendorRegistrationNumber",
    "documentNumber",
    "currency",
  ] as const;
  for (const f of stringFields) {
    if (d[f] !== undefined) {
      const v = d[f];
      if (v === null) {
        data[f] = null;
      } else {
        const max =
          f === "documentNumber" ? 80 : f === "vendorRegistrationNumber" ? 40 : f === "currency" ? 12 : 300;
        const scrubbed = SensitiveDataCleaner.sanitizePlainText(v).slice(0, max);
        data[f] = scrubbed === "" ? null : scrubbed;
      }
    }
  }
  if (d.explanation !== undefined) {
    data.explanation =
      d.explanation === null ? null : SensitiveDataCleaner.sanitizeExplanation(d.explanation);
  }
  if (d.userSourceNote !== undefined) {
    const v = d.userSourceNote;
    data.userSourceNote =
      v === null ? null : SensitiveDataCleaner.sanitizePlainText(v).slice(0, 500) || null;
  }

  let nextRetrievalLocation: string | null =
    d.retrievalLocation !== undefined
      ? d.retrievalLocation
      : existing.retrievalLocation;
  let nextRetrievalNote: string | null =
    d.retrievalCustomNote !== undefined
      ? d.retrievalCustomNote
      : existing.retrievalCustomNote;

  if (d.retrievalLocation !== undefined) {
    if (d.retrievalLocation === null) {
      data.retrievalLocation = null;
      nextRetrievalLocation = null;
    } else if (!isKnownRetrievalLocation(d.retrievalLocation)) {
      return NextResponse.json(
        { ok: false, error: "Nederīga ‘kur meklēt’ vērtība." },
        { status: 400 },
      );
    } else {
      const canon = normalizeRetrievalLocation(d.retrievalLocation)!;
      data.retrievalLocation = canon;
      nextRetrievalLocation = canon;
    }
  }
  if (d.retrievalCustomNote !== undefined) {
    data.retrievalCustomNote =
      d.retrievalCustomNote === null
        ? null
        : SensitiveDataCleaner.sanitizePlainText(d.retrievalCustomNote).slice(0, 300) || null;
    nextRetrievalNote = data.retrievalCustomNote as string | null;
  }

  const effectiveCat =
    d.category !== undefined ? d.category : existing.category ?? undefined;
  const mergedLoc =
    typeof data.retrievalLocation !== "undefined"
      ? (data.retrievalLocation as string | null)
      : nextRetrievalLocation;
  const mergedNote =
    typeof data.retrievalCustomNote !== "undefined"
      ? (data.retrievalCustomNote as string | null)
      : nextRetrievalNote;

  if (mergedLoc === "other" && !(mergedNote ?? "").trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Ja izvēlējies ‘Cits’, ieraksti, kur tieši meklēt oriģinālu.",
      },
      { status: 400 },
    );
  }

  const numberFields = [
    "deductiblePercent",
    "deductibleAmount",
  ] as const;
  for (const f of numberFields) {
    if (d[f] !== undefined) data[f] = d[f];
  }

  // ----- Top-level money + VAT reconciliation -----
  // If the user touched any of net/vat/total in this PATCH, we reconcile
  // the three so a new "Bez PVN" automatically recomputes PVN and Kopā
  // (and vice versa). Existing values not in the patch are taken from the
  // document.
  const moneyTouched =
    d.netAmount !== undefined ||
    d.vatAmount !== undefined ||
    d.totalAmount !== undefined;
  if (moneyTouched) {
    const proposedNet =
      d.netAmount !== undefined ? d.netAmount : existing.netAmount;
    const proposedVat =
      d.vatAmount !== undefined ? d.vatAmount : existing.vatAmount;
    const proposedTotal =
      d.totalAmount !== undefined ? d.totalAmount : existing.totalAmount;
    const reconciled = reconcileVat({
      netAmount: proposedNet,
      vatAmount: proposedVat,
      totalAmount: proposedTotal,
    });
    data.netAmount = reconciled.netAmount;
    data.vatAmount = reconciled.vatAmount;
    data.totalAmount = reconciled.totalAmount;
  } else {
    if (d.netAmount !== undefined) data.netAmount = d.netAmount;
    if (d.vatAmount !== undefined) data.vatAmount = d.vatAmount;
    if (d.totalAmount !== undefined) data.totalAmount = d.totalAmount;
  }

  if (d.category !== undefined) data.category = d.category;
  if (d.deductibleStatus !== undefined) data.deductibleStatus = d.deductibleStatus;
  if (d.status !== undefined) data.status = d.status;

  // userCategoryId: validate ownership and parent compatibility.
  if (d.userCategoryId !== undefined) {
    if (d.userCategoryId === null || d.userCategoryId === "") {
      data.userCategoryId = null;
    } else {
      const sub = await prisma.userCategory.findUnique({
        where: { id: d.userCategoryId },
      });
      if (!sub || sub.userId !== user.id) {
        return NextResponse.json(
          { ok: false, error: "Apakškategorija nav atrasta." },
          { status: 400 },
        );
      }
      const effectiveCategory =
        d.category !== undefined ? d.category : existing.category;
      if (effectiveCategory && sub.parentCategory !== effectiveCategory) {
        return NextResponse.json(
          {
            ok: false,
            error: "Apakškategorija neattiecas uz izvēlēto galveno kategoriju.",
          },
          { status: 400 },
        );
      }
      data.userCategoryId = sub.id;
      // If user did not explicitly set deductibleStatus / percent in this PATCH,
      // and the subcategory has overrides, apply them.
      if (d.deductibleStatus === undefined && sub.deductibleStatus) {
        data.deductibleStatus = sub.deductibleStatus;
      }
      if (d.deductiblePercent === undefined && sub.deductiblePercent !== null) {
        data.deductiblePercent = sub.deductiblePercent;
      }
    }
  }

  // If main category changed and existing subcategory no longer matches, clear it.
  if (d.category !== undefined && existing.userCategoryId && d.userCategoryId === undefined) {
    const sub = await prisma.userCategory.findUnique({
      where: { id: existing.userCategoryId },
    });
    if (sub && sub.parentCategory !== d.category) {
      data.userCategoryId = null;
    }
  }

  // ----- Line items per-row updates -----
  // Apply toggles and/or new amounts to each line item by stable `id`.
  // For each updated row we run `reconcileVat` so that if the user typed
  // a new net but left VAT/total inconsistent, we recompute at 21%.
  let nextLineItems = parseLineItems(existing.lineItemsJson);
  if (d.lineItems !== undefined) {
    if (d.lineItems === null) {
      nextLineItems = [];
    } else {
      const updateMap = new Map(d.lineItems.map((t) => [t.id, t]));
      nextLineItems = nextLineItems.map((it) => {
        const upd = updateMap.get(it.id);
        if (!upd) return it;
        const nextNet = upd.netAmount !== undefined ? upd.netAmount : it.netAmount;
        const nextVat = upd.vatAmount !== undefined ? upd.vatAmount : it.vatAmount;
        const nextTotal = upd.totalAmount !== undefined ? upd.totalAmount : it.totalAmount;
        const reconciled = reconcileVat({
          netAmount: nextNet,
          vatAmount: nextVat,
          totalAmount: nextTotal,
        });
        return {
          ...it,
          included: upd.included !== undefined ? upd.included : it.included,
          netAmount: reconciled.netAmount,
          vatAmount: reconciled.vatAmount,
          totalAmount: reconciled.totalAmount,
          vatAssumed: reconciled.vatAssumed || it.vatAssumed,
        };
      });
    }
    data.lineItemsJson = nextLineItems.length > 0 ? JSON.stringify(nextLineItems) : null;
  }

  // ----- Recompute attributed + effective deductibleAmount -----
  // newTotal must reflect the reconciled top-level total when the user
  // touched any money field this PATCH; otherwise it falls back to the
  // existing stored value.
  const newTotal =
    typeof data.totalAmount === "number"
      ? (data.totalAmount as number)
      : existing.totalAmount;
  const newPercent =
    d.deductiblePercent !== undefined ? d.deductiblePercent : existing.deductiblePercent;

  const attrTotal = nextLineItems.length > 0 ? attributedTotal(nextLineItems) : null;
  let attrDeductible: number | null = null;
  if (attrTotal !== null && typeof newPercent === "number") {
    attrDeductible = Number(((attrTotal * newPercent) / 100).toFixed(2));
  }
  if (nextLineItems.length > 0 || d.lineItems !== undefined) {
    data.totalAmountAttributed = attrTotal;
    data.deductibleAmountAttributed = attrDeductible;
  }

  // Auto-compute deductibleAmount: prefer attributed total when present.
  const effectiveTotal = attrTotal ?? (typeof newTotal === "number" ? newTotal : null);
  const userProvidedAmount = d.deductibleAmount !== undefined;
  if (
    !userProvidedAmount &&
    effectiveTotal !== null &&
    typeof newPercent === "number"
  ) {
    data.deductibleAmount = Number(((effectiveTotal * newPercent) / 100).toFixed(2));
  }

  if (d.status === undefined && (d.userConfirmedReview === true || existing.status === "needs_review")) {
    const preview = {
      status: existing.status,
      documentDate:
        data.documentDate !== undefined
          ? (data.documentDate as Date | null)
          : existing.documentDate,
      totalAmount:
        data.totalAmount !== undefined
          ? (data.totalAmount as number | null)
          : existing.totalAmount,
      totalAmountAttributed:
        data.totalAmountAttributed !== undefined
          ? (data.totalAmountAttributed as number | null)
          : existing.totalAmountAttributed,
      category:
        data.category !== undefined ? (data.category as string | null) : existing.category,
      deductibleStatus:
        data.deductibleStatus !== undefined
          ? (data.deductibleStatus as string | null)
          : existing.deductibleStatus,
      retrievalLocation:
        data.retrievalLocation !== undefined
          ? (data.retrievalLocation as string | null)
          : mergedLoc,
      needsReviewReasons: existing.needsReviewReasons,
      lineItemsJson:
        data.lineItemsJson !== undefined
          ? (data.lineItemsJson as string | null)
          : existing.lineItemsJson,
    };
    const next = recomputeDocumentStatusAfterUserEdit(preview, {
      userConfirmedReview: d.userConfirmedReview === true,
    });
    data.status = next.status;
    data.needsReviewReasons = JSON.stringify(next.needsReviewReasons);
  }

  const updated = await prisma.document.update({
    where: { id: existing.id },
    data: data as Prisma.DocumentUpdateInput,
  });

  if (d.saveRetrievalDefaultForCategory && mergedLoc && isDocumentRetrievalLocation(mergedLoc)) {
    if (effectiveCat && effectiveCat !== "unknown" && isExpenseCategory(effectiveCat)) {
      const userRow = await prisma.user.findUnique({ where: { id: user.id } });
      if (userRow) {
        const prev = parseCategoryRetrievalDefaults(userRow.categoryRetrievalDefaultsJson);
        prev[effectiveCat as keyof typeof prev] = mergedLoc;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            categoryRetrievalDefaultsJson: serializeCategoryRetrievalDefaults(prev),
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, document: serializeDocument(updated) });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.id, userId: user.id },
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  if (doc.storedFilePath) {
    await deleteUploadedFile(doc.storedFilePath);
  }

  await prisma.aiQuestion.deleteMany({ where: { documentId: doc.id } });
  await prisma.document.delete({ where: { id: doc.id } });

  return NextResponse.json({ ok: true });
}
