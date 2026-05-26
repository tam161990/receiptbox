import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getTelegramBotUsername } from "@/lib/authLogin";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) {
    redirect("/dashboard");
  }
  const pinRequired = Boolean(process.env.DEV_LOGIN_PIN && process.env.DEV_LOGIN_PIN.length > 0);
  const botUsername = getTelegramBotUsername();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/receiptbox-lv-logo.svg"
            alt="ReceiptBox LV"
            className="mx-auto h-12 w-auto"
            width={240}
            height={48}
          />
          <p className="mt-3 text-sm text-slate-600">
            Vienkāršākais veids, kā sagatavot izdevumus deklarācijai
          </p>
        </div>
        <div className="card">
          <h2 className="mb-2 text-base font-semibold text-slate-900">Pieslēgties</h2>
          <p className="mb-4 text-sm text-slate-600">
            Pieslēdzies ar Telegram — redzēsi tos pašus dokumentus, ko sūti botam{" "}
            {botUsername ? (
              <>
                <a
                  href={`https://t.me/${botUsername}`}
                  className="text-brand-700 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @{botUsername}
                </a>
              </>
            ) : null}
            .
          </p>
          <LoginForm botUsername={botUsername} pinRequired={pinRequired} />
        </div>
        <p className="mt-3 text-center text-sm">
          <Link href="/" className="text-brand-700 hover:underline">
            ← Atpakaļ uz sākumu
          </Link>
        </p>
      </div>
    </div>
  );
}
