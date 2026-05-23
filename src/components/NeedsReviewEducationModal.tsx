"use client";

import {
  NEEDS_REVIEW_MODAL,
  NEEDS_REVIEW_EDUCATION_DISMISSED_KEY,
  NEEDS_REVIEW_MODAL_SESSION_KEY,
  dismissEducation,
  isEducationDismissed,
} from "@/lib/userEducation";

export function NeedsReviewEducationModal({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  if (!open) return null;

  function dismiss() {
    dismissEducation(NEEDS_REVIEW_EDUCATION_DISMISSED_KEY);
    onDismiss();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
      role="presentation"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="needs-review-modal-title"
        className="w-full max-w-md rounded-xl border border-orange-200 bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="needs-review-modal-title" className="text-lg font-semibold text-slate-900">
          {NEEDS_REVIEW_MODAL.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{NEEDS_REVIEW_MODAL.notError}</p>
        <p className="mt-3 text-sm font-medium text-slate-800">{NEEDS_REVIEW_MODAL.checkIntro}</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-700">
          {NEEDS_REVIEW_MODAL.checkItems.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-orange-500">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <button type="button" onClick={dismiss} className="btn-primary mt-5 w-full sm:w-auto">
          {NEEDS_REVIEW_MODAL.cta}
        </button>
      </div>
    </div>
  );
}

let modalClaimed = false;

export function claimNeedsReviewModal(): boolean {
  if (modalClaimed || isEducationDismissed(NEEDS_REVIEW_EDUCATION_DISMISSED_KEY)) {
    return false;
  }
  try {
    if (sessionStorage.getItem(NEEDS_REVIEW_MODAL_SESSION_KEY) === "1") {
      return false;
    }
    sessionStorage.setItem(NEEDS_REVIEW_MODAL_SESSION_KEY, "1");
  } catch {
    // ignore
  }
  modalClaimed = true;
  return true;
}

export function releaseNeedsReviewModalClaim(): void {
  modalClaimed = false;
}
