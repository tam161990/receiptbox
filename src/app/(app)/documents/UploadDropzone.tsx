"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RetrievalLocationPicker } from "@/components/RetrievalLocationPicker";
import {
  DOCUMENT_RETRIEVAL_LOCATIONS,
  DocumentRetrievalLabels,
  type DocumentRetrievalLocation,
} from "@/lib/enums";
import {
  initialUploadRetrievalDefault,
  resolveRetrievalForNewFile,
  type UploadRetrievalHints,
} from "@/lib/uploadDefaults";

const MAX_FILES = 20;
const MAX_BYTES = 15 * 1024 * 1024;
const CONCURRENCY = 3;
const ACCEPT_RE = /\.(jpg|jpeg|png|pdf)$/i;
const ACCEPT_MIME = ["application/pdf"];
const ACCEPT_PREFIX = ["image/"];

type ItemStatus = "queued" | "uploading" | "done" | "error";

interface UploadItem {
  id: string;
  file: File;
  status: ItemStatus;
  error?: string;
  vendor?: string | null;
  totalLabel?: string | null;
  badgeLabel?: string | null;
  documentId?: string;
  documentIds?: string[];
  documentCount?: number;
  /** Kur meklēt oriģinālu — katram failam savs (bulk ar dažādiem avotiem). */
  retrievalLocation: DocumentRetrievalLocation | null;
  retrievalCustomNote: string;
}

interface UploadResponse {
  ok: boolean;
  error?: string;
  bankStatementSplit?: boolean;
  document?: {
    id: string;
    vendorName: string | null;
    totalAmount: number | null;
    currency: string | null;
    statusLabel: string;
  };
  documents?: Array<{
    id: string;
    vendorName: string | null;
    totalAmount: number | null;
    currency: string | null;
    statusLabel: string;
  }>;
}

function UploadSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-brand-700">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
        aria-hidden
      />
      {label}
    </span>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (file.size === 0) return "Tukšs fails.";
  if (file.size > MAX_BYTES) return `Pārāk liels (maks. ${MAX_BYTES / 1024 / 1024} MB).`;
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  const ok =
    ACCEPT_PREFIX.some((p) => type.startsWith(p)) ||
    ACCEPT_MIME.includes(type) ||
    ACCEPT_RE.test(name);
  if (!ok) return "Neatbalstīts faila tips (atļauts JPG, PNG, PDF).";
  return null;
}

export function UploadDropzone({
  retrievalHints,
}: {
  retrievalHints: UploadRetrievalHints;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const [isDragOver, setIsDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  /** Noklusējums tikai jauniem failiem rindā — katru rindiņu var pārdefinēt atsevišķi. */
  const [defaultRetrievalLocation, setDefaultRetrievalLocation] =
    useState<DocumentRetrievalLocation | null>(null);
  const [defaultRetrievalCustomNote, setDefaultRetrievalCustomNote] = useState("");

  useEffect(() => {
    const loc = initialUploadRetrievalDefault(retrievalHints);
    if (loc) {
      setDefaultRetrievalLocation(loc);
    }
  }, [retrievalHints]);

  const inFlightRef = useRef(0);
  /** Tikai ID — vienmēr ņemam aktuālos laukus no itemsRef. */
  const queueRef = useRef<string[]>([]);
  const pumpRef = useRef<() => void>(() => {});

  const counts = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === "done").length;
    const errors = items.filter((i) => i.status === "error").length;
    const active = items.filter((i) => i.status === "uploading").length;
    const queued = items.filter((i) => i.status === "queued").length;
    return { total, done, errors, active, queued };
  }, [items]);

  const allFinished = counts.total > 0 && counts.active === 0 && counts.queued === 0;

  useEffect(() => {
    if (allFinished) {
      router.refresh();
    }
  }, [allFinished, router]);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const enqueueIfReady = useCallback((itemId: string) => {
    const row = itemsRef.current.find((i) => i.id === itemId);
    if (!row || row.status !== "queued" || !row.retrievalLocation) return;
    if (row.retrievalLocation === "other" && !row.retrievalCustomNote.trim()) return;
    if (!queueRef.current.includes(itemId)) {
      queueRef.current.push(itemId);
    }
    queueMicrotask(() => pumpRef.current());
  }, []);

  const uploadOne = useCallback(
    async (itemId: string) => {
      const snapshot = itemsRef.current.find((i) => i.id === itemId && i.status === "queued");
      if (!snapshot) return;

      const loc = snapshot.retrievalLocation;
      const note = snapshot.retrievalCustomNote.trim();

      if (!loc || (loc === "other" && !note)) {
        return;
      }

      updateItem(itemId, { status: "uploading", error: undefined });
      try {
        const form = new FormData();
        form.append("file", snapshot.file);
        form.append("retrievalLocation", loc);
        if (note) {
          form.append("retrievalCustomNote", note);
        }
        const res = await fetch("/api/documents/upload", {
          method: "POST",
          body: form,
        });
        const data: UploadResponse = await res.json().catch(() => ({ ok: false }));
        const docs =
          data.documents ?? (data.document ? [data.document] : []);
        if (!res.ok || !data.ok || docs.length === 0) {
          updateItem(itemId, {
            status: "error",
            error: data.error || `Neizdevās augšupielādēt (${res.status}).`,
          });
          return;
        }

        const formatDocMoney = (doc: (typeof docs)[number]) =>
          doc.totalAmount != null
            ? new Intl.NumberFormat("lv-LV", {
                style: "currency",
                currency: doc.currency || "EUR",
              }).format(doc.totalAmount)
            : null;

        const isSplit = Boolean(data.bankStatementSplit) || docs.length > 1;
        const totalLabel = isSplit
          ? `${docs.length} maksājumi`
          : formatDocMoney(docs[0]!);
        const badgeLabel = isSplit
          ? `${docs.length} dokumenti tabulā`
          : docs[0]!.statusLabel;

        updateItem(itemId, {
          status: "done",
          documentId: docs[0]!.id,
          documentIds: docs.map((d) => d.id),
          documentCount: docs.length,
          vendor: docs[0]!.vendorName,
          totalLabel,
          badgeLabel,
        });
        router.refresh();
      } catch (err) {
        updateItem(itemId, {
          status: "error",
          error: err instanceof Error ? err.message : "Tīkla kļūda.",
        });
      }
    },
    [updateItem, router],
  );

  const pump = useCallback(() => {
    while (inFlightRef.current < CONCURRENCY && queueRef.current.length > 0) {
      let pickIdx = -1;
      let pickId: string | null = null;
      for (let i = 0; i < queueRef.current.length; i++) {
        const qid = queueRef.current[i]!;
        const row = itemsRef.current.find((r) => r.id === qid && r.status === "queued");
        if (!row?.retrievalLocation) continue;
        if (row.retrievalLocation === "other" && !row.retrievalCustomNote.trim()) continue;
        pickIdx = i;
        pickId = qid;
        break;
      }
      if (!pickId || pickIdx < 0) break;
      queueRef.current.splice(pickIdx, 1);

      inFlightRef.current += 1;
      void uploadOne(pickId).finally(() => {
        inFlightRef.current -= 1;
        pumpRef.current();
      });
    }
  }, [uploadOne]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const applyDefaultToQueued = useCallback(() => {
    setItems((prev) => {
      const merged = prev.map((it) =>
        it.status === "queued"
          ? {
              ...it,
              retrievalLocation: defaultRetrievalLocation,
              retrievalCustomNote:
                defaultRetrievalLocation === "other"
                  ? defaultRetrievalCustomNote
                  : defaultRetrievalLocation
                    ? ""
                    : it.retrievalCustomNote,
              error: undefined,
            }
          : it,
      );
      itemsRef.current = merged;
      for (const row of merged) {
        if (row.status === "queued" && row.retrievalLocation) {
          if (row.retrievalLocation === "other" && !row.retrievalCustomNote.trim()) continue;
          if (!queueRef.current.includes(row.id)) queueRef.current.push(row.id);
        }
      }
      queueMicrotask(() => pumpRef.current());
      return merged;
    });
  }, [defaultRetrievalLocation, defaultRetrievalCustomNote]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setGlobalError(null);
      const incoming = Array.from(files);

      setItems((prev) => {
        const remainingSlots = MAX_FILES - prev.filter((i) => i.status !== "error").length;
        if (incoming.length > remainingSlots) {
          queueMicrotask(() =>
            setGlobalError(`Maksimāli ${MAX_FILES} faili vienlaikus.`),
          );
        }
        const accepted = incoming.slice(0, Math.max(0, remainingSlots));
        const newItems: UploadItem[] = accepted.map((file) => {
          const error = validateFile(file);
          const autoLoc = error
            ? null
            : resolveRetrievalForNewFile(file.name, retrievalHints, defaultRetrievalLocation);
          const noteForNew =
            autoLoc === "other"
              ? defaultRetrievalCustomNote
              : autoLoc
                ? ""
                : "";
          return {
            id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            file,
            status: error ? "error" : "queued",
            error: error ?? undefined,
            retrievalLocation: autoLoc,
            retrievalCustomNote: error ? "" : noteForNew,
          };
        });
        const merged = [...prev, ...newItems];
        itemsRef.current = merged;
        const enqueueable = newItems.filter((i) => i.status === "queued" && i.retrievalLocation);
        for (const q of enqueueable) {
          if (q.retrievalLocation === "other" && !q.retrievalCustomNote.trim()) continue;
          queueRef.current.push(q.id);
        }
        queueMicrotask(() => pumpRef.current());
        return merged;
      });
    },
    [defaultRetrievalLocation, defaultRetrievalCustomNote, retrievalHints],
  );

  const handlePickClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const clearFinished = () => {
    setItems((prev) => prev.filter((i) => i.status !== "done" && i.status !== "error"));
  };

  const removeItem = (id: string) => {
    queueRef.current = queueRef.current.filter((qid) => qid !== id);
    setItems((prev) => {
      const merged = prev.filter((i) => i.id !== id);
      itemsRef.current = merged;
      return merged;
    });
  };

  const retryItem = (id: string) => {
    setItems((prev) => {
      const merged = prev.map((i) =>
        i.id === id ? { ...i, status: "queued" as const, error: undefined } : i,
      );
      itemsRef.current = merged;
      return merged;
    });
    queueRef.current.push(id);
    queueMicrotask(() => pumpRef.current());
  };

  function rowRetrievalLabel(it: UploadItem): string {
    if (!it.retrievalLocation) return "—";
    const base = DocumentRetrievalLabels[it.retrievalLocation];
    if (it.retrievalLocation === "other" && it.retrievalCustomNote.trim()) {
      return `${base}: ${it.retrievalCustomNote.trim()}`;
    }
    return base;
  }

  return (
    <div className="space-y-3">
      <div
        className={[
          "card space-y-2 p-4",
          !defaultRetrievalLocation ? "border-amber-100 bg-amber-50/30" : "",
        ].join(" ")}
      >
        <div>
          <p className="text-sm font-medium text-slate-900">
            Noklusējums jaunajiem failiem
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Ja augšupielādē <strong>dažādus</strong> rēķinus, izvēlies noklusējumu vai atstāj tukšu —{" "}
            <strong>katrā rindiņā</strong> vari norādīt savu vietu.             Sistēma atceras pēdējo izvēlēto avotu līdzīgiem rēķiniem.
          </p>
        </div>
        <RetrievalLocationPicker
          idPrefix="upload-default"
          selected={defaultRetrievalLocation ?? ""}
          customNote={defaultRetrievalCustomNote}
          onLocationChange={(loc) => {
            setDefaultRetrievalLocation(loc);
            if (loc !== "other") setDefaultRetrievalCustomNote("");
          }}
          onCustomNoteChange={setDefaultRetrievalCustomNote}
        />
        {counts.queued > 0 ? (
          <button
            type="button"
            onClick={applyDefaultToQueued}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Lietot šo noklusējumu visiem failiem, kas vēl gaida rindā
          </button>
        ) : null}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={handlePickClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handlePickClick();
        }}
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition",
          isDragOver
            ? "border-brand-500 bg-brand-50"
            : "border-slate-300 bg-white hover:border-brand-400 hover:bg-slate-50",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf,.pdf,.png,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <p className="text-sm font-medium text-slate-800">
          Velc šurp failus vai noklikšķini, lai izvēlētos
        </p>
        <p className="mt-1 text-xs text-slate-500">
          JPG, PNG, PDF · līdz {MAX_BYTES / 1024 / 1024} MB katrs · maks. {MAX_FILES} faili
        </p>
      </div>

      {globalError ? (
        <p className="text-xs text-rose-700">{globalError}</p>
      ) : null}

      {items.length > 0 ? (
        <div className="card space-y-2 p-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              {counts.done} no {counts.total} pabeigti
              {counts.errors > 0 ? ` · ${counts.errors} kļūdas` : ""}
              {counts.active > 0 || counts.queued > 0
                ? ` · ${counts.active + counts.queued} apstrādē`
                : ""}
            </span>
            {counts.done + counts.errors > 0 ? (
              <button
                type="button"
                onClick={clearFinished}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Notīrīt pabeigtos
              </button>
            ) : null}
          </div>

          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li
                key={it.id}
                className={[
                  "flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-start",
                  it.status === "uploading" ? "rounded-md bg-brand-50/60 px-2 -mx-2" : "",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-slate-800">{it.file.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatBytes(it.file.size)}</span>
                  </div>

                  {it.status === "queued" || it.status === "error" ? (
                    <div className="flex flex-col gap-2 sm:max-w-md">
                      <label className="block">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          Kur meklēt šim failam
                        </span>
                        <select
                          className="input mt-0.5 py-1.5 text-xs"
                          value={it.retrievalLocation ?? ""}
                          onChange={(e) => {
                            const v = e.target.value as DocumentRetrievalLocation | "";
                            const loc = v === "" ? null : v;
                            const note =
                              loc === "other"
                                ? it.retrievalCustomNote
                                : loc
                                  ? ""
                                  : it.retrievalCustomNote;
                            setItems((prev) => {
                              const merged = prev.map((row) =>
                                row.id === it.id
                                  ? {
                                      ...row,
                                      retrievalLocation: loc,
                                      retrievalCustomNote: note,
                                      error: undefined,
                                    }
                                  : row,
                              );
                              itemsRef.current = merged;
                              return merged;
                            });
                            if (loc && loc !== "other") {
                              queueMicrotask(() => enqueueIfReady(it.id));
                            }
                          }}
                        >
                          <option value="">— Izvēlies —</option>
                          {DOCUMENT_RETRIEVAL_LOCATIONS.map((code) => (
                            <option key={code} value={code}>
                              {DocumentRetrievalLabels[code]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {it.retrievalLocation === "other" ? (
                        <input
                          className="input py-1.5 text-xs"
                          placeholder="Kur tieši? (īsi)"
                          value={it.retrievalCustomNote}
                          maxLength={300}
                          onChange={(e) => {
                            const note = e.target.value;
                            setItems((prev) => {
                              const merged = prev.map((row) =>
                                row.id === it.id
                                  ? { ...row, retrievalCustomNote: note, error: undefined }
                                  : row,
                              );
                              itemsRef.current = merged;
                              return merged;
                            });
                            if (note.trim()) {
                              queueMicrotask(() => enqueueIfReady(it.id));
                            }
                          }}
                        />
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600">
                      <span className="text-slate-500">Kur meklēt: </span>
                      {rowRetrievalLabel(it)}
                    </div>
                  )}

                  {it.status === "uploading" ? (
                    <div className="flex items-center gap-2 text-xs text-brand-800">
                      <UploadSpinner label="Augšupielādē un apstrādā…" />
                    </div>
                  ) : null}
                  {it.status === "done" ? (
                    <div className="text-xs text-slate-500">
                      {[it.vendor, it.totalLabel, it.badgeLabel].filter(Boolean).join(" · ") ||
                        "Apstrādāts"}
                    </div>
                  ) : null}
                  {it.status === "error" ? (
                    <div className="text-xs text-rose-700">{it.error}</div>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
                  {it.status === "queued" && !it.retrievalLocation ? (
                    <span className="text-xs text-amber-700">Izvēlies avotu ↓</span>
                  ) : null}
                  {it.status === "queued" && it.retrievalLocation ? (
                    <span className="text-xs text-slate-400">Gaida rindā…</span>
                  ) : null}
                  {it.status === "uploading" ? (
                    <UploadSpinner label="Apstrādā…" />
                  ) : null}
                  {it.status === "done" ? (
                    <>
                      {it.documentCount && it.documentCount > 1 ? (
                        <span className="text-xs font-medium text-emerald-700">
                          {it.documentCount} rindas tabulā ↓
                        </span>
                      ) : it.documentId ? (
                        <a
                          href={`/documents/${it.documentId}`}
                          className="text-xs font-medium text-brand-700 hover:underline"
                        >
                          Atvērt
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        Gatavs
                      </button>
                    </>
                  ) : null}
                  {it.status === "error" ? (
                    <button
                      type="button"
                      onClick={() => retryItem(it.id)}
                      className="text-xs font-medium text-brand-700 hover:underline"
                    >
                      Mēģināt vēlreiz
                    </button>
                  ) : null}
                  {it.status !== "uploading" ? (
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="text-xs text-slate-400 hover:text-slate-700"
                      title="Noņemt no saraksta"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
