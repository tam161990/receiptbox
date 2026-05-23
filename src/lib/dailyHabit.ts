import type { LucideIcon } from "lucide-react";
import { BarChart3, Coffee, FileText, Send } from "lucide-react";

export interface DailyHabitStep {
  id: string;
  emoji: string;
  title: string;
  body: string;
  Icon: LucideIcon;
}

export const DAILY_HABIT_STEPS: DailyHabitStep[] = [
  {
    id: "receive",
    emoji: "📬",
    title: "Saņem rēķinu",
    body: "Čeks, PDF vai screenshot — kā ierasti.",
    Icon: FileText,
  },
  {
    id: "send",
    emoji: "📱",
    title: "Sūti Telegram botam",
    body: "Viena sekunde — un viss.",
    Icon: Send,
  },
  {
    id: "forget",
    emoji: "☕",
    title: "Aizmirsti par to",
    body: "ReceiptBox sakārto — tev nav jādomā.",
    Icon: Coffee,
  },
  {
    id: "report",
    emoji: "📊",
    title: "Ģenerē pārskatu",
    body: "Kad pienāk laiks — viss jau gatavs.",
    Icon: BarChart3,
  },
];

export const DAILY_HABIT_FAQ = {
  q: "Kā tas darbojas ikdienā?",
  a: "Saņem rēķinu vai čeku → sūti Telegram botam → aizmirsti par to līdz deklarācijai. ReceiptBox visu sakārto pa kluso. Kad pienāk laiks, atver pārskatu un eksportē. Tik vienkārši 😄",
};

export const ONBOARDING_DISMISSED_KEY = "rblv_onboarding_dismissed";