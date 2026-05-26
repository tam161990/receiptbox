"use client";

import { LoginForm } from "@/app/login/LoginForm";

export function LoginModal({
  open,
  onClose,
  botUsername,
  pinRequired,
}: {
  open: boolean;
  onClose: () => void;
  botUsername: string | null;
  pinRequired: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      onClick={onClose}
    >
      <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="login-modal-title" className="text-base font-semibold text-slate-900">
              Pieslēgties
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {botUsername ? (
                <>
                  Izmanto Telegram pogu — tas pašas dati, ko botā{" "}
                  <a
                    href={`https://t.me/${botUsername}`}
                    className="text-brand-700 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    @{botUsername}
                  </a>
                  .
                </>
              ) : (
                "Ievadi Telegram ID no bota komandas /id."
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Aizvērt"
          >
            ✕
          </button>
        </div>
        <LoginForm botUsername={botUsername} pinRequired={pinRequired} redirectTo="/dashboard" />
      </div>
    </div>
  );
}
