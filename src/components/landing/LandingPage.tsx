"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CookieConsent } from "@/components/CookieConsent";
import { LoginModal } from "./LoginModal";
import { HeroSection } from "./HeroSection";
import { StoryCardsSection } from "./StoryCardsSection";
import { DailyHabitSection } from "./DailyHabitSection";
import { BenefitsSection } from "./BenefitsSection";
import { PrivacySection } from "./PrivacySection";
import { ScreenshotsSection } from "./ScreenshotsSection";
import { BetaSection } from "./BetaSection";
import { FaqSection } from "./FaqSection";
import { FinalCtaSection } from "./FinalCtaSection";
import { MotionButton } from "./landingMotion";

export function LandingPage({
  pinRequired,
  initialLoginOpen = false,
}: {
  pinRequired: boolean;
  initialLoginOpen?: boolean;
}) {
  const [loginOpen, setLoginOpen] = useState(initialLoginOpen);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/receiptbox-lv-logo.svg"
              alt="ReceiptBox LV"
              className="h-9 w-auto"
              width={200}
              height={40}
            />
          </Link>
          <MotionButton type="button" onClick={openLogin} className="btn-primary">
            Pieslēgties
          </MotionButton>
        </div>
      </header>

      <main>
        <HeroSection
          onBeta={() => scrollTo("beta")}
          onHowItWorks={() => scrollTo("daily-habit")}
        />
        <StoryCardsSection />
        <DailyHabitSection />
        <BenefitsSection />
        <PrivacySection />
        <ScreenshotsSection />
        <BetaSection onApply={openLogin} />
        <FaqSection />
        <FinalCtaSection onBeta={() => scrollTo("beta")} />
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <p>ReceiptBox LV &middot; MVP</p>
        <p className="mt-2">
          <Link href="/#privacy" className="text-brand-700 hover:underline">
            Privātums
          </Link>
          <span className="mx-2">&middot;</span>
          Šī nav grāmatvedības vai nodokļu konsultācija.
        </p>
      </footer>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} pinRequired={pinRequired} />
      <CookieConsent />
    </div>
  );
}
