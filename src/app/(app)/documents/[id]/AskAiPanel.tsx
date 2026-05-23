"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface QnA {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

function AiSparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
      />
    </svg>
  );
}

export function AskAiPanel({ documentId }: { documentId: string }) {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QnA[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/documents/${documentId}/ask`);
        const data = await res.json().catch(() => ({ ok: false }));
        if (!cancelled && data.ok && Array.isArray(data.questions)) {
          setHistory(data.questions);
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 3) {
      setError("Jautājums ir pārāk īss.");
      return;
    }
    setAsking(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setError(data.error || data.answer || "Neizdevās saņemt atbildi.");
      }
      if (data.questionId) {
        setHistory((prev) => [
          {
            id: data.questionId,
            question,
            answer: data.answer,
            createdAt: data.createdAt,
          },
          ...prev,
        ]);
        setQuestion("");
      }
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
          <AiSparkleIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-brand-900">
            Konsultējies ar AI par šo dokumentu
          </h2>
          <p className="mt-0.5 text-sm text-brand-800/80">
            Apraksti savu situāciju — AI ieteiks, kā rīkoties, izmantojot šī dokumenta datus un tavu
            profilu.{" "}
            <Link href="/profile" className="font-medium text-brand-700 hover:underline">
              Aizpildi profilu
            </Link>
            , lai atbildes būtu precīzākas.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          className="input min-h-[72px] border-brand-200 bg-white/90 focus:border-brand-500 focus:ring-brand-500"
          placeholder="piem., Es strādāju no mājām 70% laika kā IT konsultants. Vai šo rēķinu varu atskaitīt pilnībā?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1500}
        />
        {error ? (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="btn-primary" disabled={asking}>
            {asking ? "AI domā…" : "Jautāt AI"}
          </button>
          <span className="text-xs text-brand-800/70">
            AI nesniedz juridiskas garantijas — pirms iesniegšanas pārbaudi ar grāmatvedi.
          </span>
        </div>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-brand-900">Iepriekšējie jautājumi</h3>
        {loadingHistory ? (
          <p className="mt-1.5 text-sm text-brand-800/70">Ielādē…</p>
        ) : history.length === 0 ? (
          <p className="mt-1.5 text-sm text-brand-800/70">
            Vēl nav nevienas konsultācijas par šo dokumentu.
          </p>
        ) : (
          <ul className="mt-1.5 space-y-2">
            {history.map((q) => (
              <li
                key={q.id}
                className="rounded-lg border border-brand-100 bg-white/80 p-2.5 shadow-sm"
              >
                <div className="text-xs text-brand-700/70">
                  {new Date(q.createdAt).toLocaleString("lv-LV")}
                </div>
                <div className="mt-0.5 text-sm font-medium text-slate-900">{q.question}</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{q.answer}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
