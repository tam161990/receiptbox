"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Sākums" },
  { href: "/documents", label: "Dokumenti" },
  { href: "/reports", label: "Pārskats" },
  { href: "/profile", label: "Profils" },
  { href: "/privacy", label: "Privātums" },
];

export function NavBar({
  telegramUserId,
  displayName,
}: {
  telegramUserId: string;
  displayName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  function navLinkClass(active: boolean, mobile = false): string {
    const base = mobile
      ? "block rounded-lg px-3 py-2.5 text-sm font-medium transition"
      : "rounded-lg px-3 py-2 text-sm font-medium transition";
    return active
      ? `${base} bg-brand-50 text-brand-700`
      : `${base} text-slate-600 hover:bg-slate-100`;
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/dashboard" className="flex min-w-0 shrink items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/receiptbox-lv-logo.svg"
            alt="ReceiptBox LV"
            className="h-9 w-auto max-w-[11rem] sm:max-w-none sm:h-10"
            width={200}
            height={40}
          />
        </Link>

        <nav className="hidden gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={navLinkClass(active)}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 text-sm">
          <div className="hidden text-right md:block">
            <div className="font-medium text-slate-900">{displayName}</div>
            <div className="text-xs text-slate-500">Telegram ID: {telegramUserId}</div>
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 md:hidden"
            aria-expanded={menuOpen}
            aria-label="Navigācijas izvēlne"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
          <button type="button" onClick={handleLogout} className="btn-secondary hidden sm:inline-flex">
            Iziet
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav className="border-t border-slate-100 px-4 py-2 md:hidden">
          <ul className="grid grid-cols-2 gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <li key={item.href} className={item.href === "/privacy" ? "col-span-2" : undefined}>
                  <Link
                    href={item.href}
                    className={navLinkClass(active, true)}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="col-span-2 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="btn-secondary w-full"
              >
                Iziet
              </button>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
