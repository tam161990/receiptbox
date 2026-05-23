import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { PwaInstallHint } from "@/components/PwaInstallHint";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/");
  }
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.telegramUsername ||
    `Lietotājs ${user.telegramUserId}`;
  return (
    <div className="min-h-screen">
      <NavBar telegramUserId={user.telegramUserId} displayName={displayName} />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-safe">
        <div className="mb-4">
          <PwaInstallHint />
        </div>
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        ReceiptBox LV &middot; MVP &middot;{' '}
        <a href="/privacy" className="text-brand-700 hover:underline">
          Privātums — oriģinālie dokumenti netiek glabāti
        </a>
        <span className="mx-1">&middot;</span>
        Šī nav grāmatvedības vai nodokļu konsultācija.
      </footer>
    </div>
  );
}
