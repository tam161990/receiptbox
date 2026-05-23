import { VENDOR_IDENTIFIER_GUIDES } from "@/lib/identifierHints";

/** Profilā: tabula — kuram rēķinam kāds identifikators. */
export function IdentifierGuidePanel({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
        {VENDOR_IDENTIFIER_GUIDES.filter((g) => g.id !== "generic").map((g) => (
          <li key={g.id}>
            <span className="font-medium text-slate-800">{g.vendorLabel}</span>
            {" — "}
            {g.whatToEnter.split(".")[0]}.
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-100/80 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Piegādātājs</th>
            <th className="px-3 py-2">Ko ievadīt profilā</th>
            <th className="hidden px-3 py-2 sm:table-cell">Piemērs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {VENDOR_IDENTIFIER_GUIDES.map((g) => (
            <tr key={g.id}>
              <td className="px-3 py-2 align-top">
                <div className="font-medium text-slate-900">{g.vendorLabel}</div>
                <div className="text-xs text-slate-500">{g.billType}</div>
              </td>
              <td className="px-3 py-2 align-top text-slate-700">
                <p>{g.whatToEnter}</p>
                {g.avoid ? (
                  <p className="mt-1 text-xs text-amber-800/90">{g.avoid}</p>
                ) : null}
              </td>
              <td className="hidden px-3 py-2 align-top sm:table-cell">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                  {g.examples[0]}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
