import Link from "next/link";
import type { SortDir } from "@/lib/documentListSort";

interface SortableThProps {
  label: string;
  column: string;
  currentSort: string;
  currentDir: SortDir;
  queryBase: Record<string, string>;
  align?: "left" | "right";
  className?: string;
  compact?: boolean;
}

export function SortableTh({
  label,
  column,
  currentSort,
  currentDir,
  queryBase,
  align = "left",
  className = "",
  compact = false,
}: SortableThProps) {
  const active = currentSort === column;
  const nextDir: SortDir = active && currentDir === "desc" ? "asc" : "desc";
  const params = new URLSearchParams(queryBase);
  params.set("sort", column);
  params.set("dir", nextDir);

  const alignClass = align === "right" ? "ml-auto" : "";
  const pad = compact ? "px-2 py-2" : "px-4 py-3";

  return (
    <th className={`${pad} ${className}`}>
      <Link
        href={`/documents?${params.toString()}`}
        className={`group inline-flex items-center gap-1 hover:text-slate-900 ${alignClass} ${
          active ? "font-semibold text-slate-900" : ""
        }`}
        title={`Kārtot pēc: ${label}`}
      >
        <span>{label}</span>
        <span
          className={`text-[10px] ${active ? "text-brand-600" : "text-slate-300 group-hover:text-slate-400"}`}
          aria-hidden
        >
          {active ? (currentDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </Link>
    </th>
  );
}
