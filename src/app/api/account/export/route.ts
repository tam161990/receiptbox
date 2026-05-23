import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { serializeDocument } from "@/lib/documents";
import { parseCategoryLabels, serializeUserCategory } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GDPR-style JSON export of everything stored for the logged-in user. */
export async function GET(): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: {
      documents: { include: { userCategory: true }, orderBy: { uploadedAt: "desc" } },
      userCategories: { orderBy: [{ parentCategory: "asc" }, { sortOrder: "asc" }] },
      aiQuestions: { orderBy: { createdAt: "desc" }, take: 500 },
    },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const customLabels = parseCategoryLabels(user.categoryLabelsJson);
  const payload = {
    exportedAt: new Date().toISOString(),
    receiptBoxVersion: "mvp-privacy-first",
    user: {
      id: user.id,
      telegramUserId: user.telegramUserId,
      telegramUsername: user.telegramUsername,
      firstName: user.firstName,
      lastName: user.lastName,
      selfEmployedType: user.selfEmployedType,
      workFromHomePercent: user.workFromHomePercent,
      mainActivityDescription: user.mainActivityDescription,
      categoryDefaultsJson: user.categoryDefaultsJson,
      categoryRetrievalDefaultsJson: user.categoryRetrievalDefaultsJson,
      categoryLabelsJson: user.categoryLabelsJson,
      myIdentifiersJson: user.myIdentifiersJson,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
    documents: user.documents.map((d) => serializeDocument(d, { customLabels })),
    userCategories: user.userCategories.map(serializeUserCategory),
    aiQuestions: user.aiQuestions.map((q) => ({
      id: q.id,
      documentId: q.documentId,
      question: q.question,
      answer: q.answer,
      createdAt: q.createdAt.toISOString(),
    })),
  };

  return NextResponse.json(payload, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="receiptbox-lv-export-${user.id.slice(0, 8)}.json"`,
    },
  });
}
