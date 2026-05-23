export const ONBOARDING_DISMISSED_KEY = "rblv_onboarding_dismissed";
export const PROFILE_TIP_DISMISSED_KEY = "rblv_profile_tip_dismissed";
export const NEEDS_REVIEW_EDUCATION_DISMISSED_KEY = "rblv_needs_review_education_dismissed";
export const NEEDS_REVIEW_MODAL_SESSION_KEY = "rblv_needs_review_modal_session";

export const PROFILE_TIP = {
  title: "Mazs padoms",
  intro: "ReceiptBox darbojas arī bez iestatījumiem.",
  detail: "Bet daži profila dati var uzlabot precizitāti:",
  items: ["identifikatori", "kategorijas", "procenti"],
  telegramItems: ["identifikatori", "kategorijas", "darba procenti"],
} as const;

export const NEEDS_REVIEW_MODAL = {
  title: "Ko nozīmē \"Jāpārbauda\"?",
  notError: "Tas nav kļūda — tikai neliela neskaidrība.",
  checkIntro: "Ātri pārbaudi:",
  checkItems: ["summas", "rindas", "kategorijas"],
  cta: "Sapratu",
} as const;

export const NEEDS_REVIEW_TOOLTIP = {
  lines: [
    "ReceiptBox nav pilnīgi pārliecināts.",
    "Ātri pārbaudi datus.",
    "ReceiptBox šoreiz mazliet šaubās 😊",
  ],
} as const;

export function isEducationDismissed(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

export function dismissEducation(key: string): void {
  try {
    localStorage.setItem(key, "1");
    window.dispatchEvent(new CustomEvent("rblv-education-dismissed", { detail: key }));
  } catch {
    // ignore
  }
}
