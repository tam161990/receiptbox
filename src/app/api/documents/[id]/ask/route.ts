import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import { answerUserQuestion } from "@/lib/ai";
import { buildUserContext } from "@/lib/documents";
import { isDeductibleStatus, isExpenseCategory } from "@/lib/enums";
import { trackUsage, USAGE_EVENT_TYPES } from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  question: z.string().min(3).max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const sessionUser = await getUserFromRequest(req);
  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Jautājums ir pārāk īss vai pārāk garš." },
      { status: 400 },
    );
  }

  const doc = await prisma.document.findFirst({
    where: { id: params.id, userId: sessionUser.id },
    include: { user: true },
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const userContext = buildUserContext(doc.user);

  const ai = await answerUserQuestion(parsed.data.question, {
    user: userContext,
    document: {
      vendorName: doc.vendorName,
      documentDate: doc.documentDate ? doc.documentDate.toISOString().slice(0, 10) : null,
      category: isExpenseCategory(doc.category) ? doc.category : null,
      totalAmount: doc.totalAmount,
      vatAmount: doc.vatAmount,
      currency: doc.currency,
      deductibleStatus: isDeductibleStatus(doc.deductibleStatus)
        ? doc.deductibleStatus
        : null,
      deductiblePercent: doc.deductiblePercent,
      explanation: doc.explanation,
    },
  });

  // Store the Q&A history regardless of success — useful for debugging.
  const saved = await prisma.aiQuestion.create({
    data: {
      userId: sessionUser.id,
      documentId: doc.id,
      question: parsed.data.question.slice(0, 2000),
      answer: ai.answer.slice(0, 4000),
    },
  });

  void trackUsage({
    userId: sessionUser.id,
    eventType: USAGE_EVENT_TYPES.ASK_AI,
    aiQuestionCount: 1,
    metadata: { documentId: doc.id, questionId: saved.id },
  });

  return NextResponse.json({
    ok: ai.ok,
    answer: ai.answer,
    questionId: saved.id,
    createdAt: saved.createdAt.toISOString(),
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const sessionUser = await getUserFromRequest(req);
  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const doc = await prisma.document.findFirst({
    where: { id: params.id, userId: sessionUser.id },
    select: { id: true },
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const items = await prisma.aiQuestion.findMany({
    where: { userId: sessionUser.id, documentId: doc.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({
    ok: true,
    questions: items.map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      createdAt: q.createdAt.toISOString(),
    })),
  });
}
