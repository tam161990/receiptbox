"use client";

import {
  DOCUMENT_RETRIEVAL_LOCATIONS,
  DocumentRetrievalLabels,
  type DocumentRetrievalLocation,
} from "@/lib/enums";

export function RetrievalLocationPicker({
  selected,
  customNote,
  onLocationChange,
  onCustomNoteChange,
  idPrefix = "retrieval",
}: {
  selected: DocumentRetrievalLocation | "";
  customNote: string;
  onLocationChange: (loc: DocumentRetrievalLocation) => void;
  onCustomNoteChange: (note: string) => void;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {DOCUMENT_RETRIEVAL_LOCATIONS.map((code) => {
          const active = selected === code;
          return (
            <button
              key={code}
              type="button"
              id={`${idPrefix}-${code}`}
              onClick={() => onLocationChange(code)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-400 hover:bg-slate-50",
              ].join(" ")}
            >
              {DocumentRetrievalLabels[code]}
            </button>
          );
        })}
      </div>
      {selected === "other" ? (
        <label className="block">
          <span className="label text-xs">Norādi, kur tieši</span>
          <input
            className="input"
            placeholder="piem., Swedbank internetbanka → Dokumenti"
            value={customNote}
            onChange={(e) => onCustomNoteChange(e.target.value)}
            maxLength={300}
          />
        </label>
      ) : null}
    </div>
  );
}
