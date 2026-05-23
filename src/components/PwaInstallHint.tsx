"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "rblv_pwa_install_dismissed";

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari standalone
    window.navigator.standalone === true
  );
}

export function PwaInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isMobileDevice() || isStandalone()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // ignore
    }
    setVisible(true);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            Pievieno ReceiptBox sākuma ekrānam, lai atvērtu to kā lietotni.
          </p>
          {isIos() ? (
            <p className="mt-2 text-brand-900/90">
              iPhone: pieskaries Share pogai un izvēlies &lsquo;Add to Home Screen&rsquo;.
            </p>
          ) : (
            <p className="mt-2 text-brand-900/90">
              Android: pārlūkā izvēlies &lsquo;Install app&rsquo; vai &lsquo;Add to Home
              screen&rsquo;.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100"
          aria-label="Aizvērt"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
