"use client";

import type { ReactNode } from "react";
import { useOnboarding } from "@/lib/onboarding/context";
import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { WhatIsLoopLaunchSection } from "./WhatIsLoopLaunchSection";
import { HowItWorksSection } from "./HowItWorksSection";
import { DeepResearchSection } from "./DeepResearchSection";
import { StrategicIntelligenceSection } from "./StrategicIntelligenceSection";
import { StrategyOutputSection } from "./StrategyOutputSection";
import { FinalCtaSection } from "./FinalCtaSection";
import { LandingFooter } from "./LandingFooter";
import { WaitlistHero, WAITLIST_INPUT_ID } from "@/components/waitlist/WaitlistHero";

const scrollToHero = () => {
  document.getElementById("hero-section")?.scrollIntoView({ behavior: "smooth" });
};

/** The full landing page with the onboarding questions in the hero (team only, at /home). */
export function LandingPage() {
  const { goToStep } = useOnboarding();

  const handleStartOnboarding = () => {
    goToStep(0);
    scrollToHero();
  };

  return (
    <LandingLayout hero={<HeroSection />} onNavCta={scrollToHero} onFinalCta={handleStartOnboarding} />
  );
}

/** The public landing page while Loop Launch is invite-only: same page, waitlist hero. */
export function WaitlistLandingPage({ signedInEmail }: { signedInEmail?: string | null }) {
  const focusWaitlist = () => {
    const input = document.getElementById(WAITLIST_INPUT_ID);
    if (input) {
      input.scrollIntoView({ behavior: "smooth", block: "center" });
      input.focus({ preventScroll: true });
    } else {
      scrollToHero();
    }
  };

  return (
    <LandingLayout
      hero={<WaitlistHero signedInEmail={signedInEmail} />}
      navCtaLabel="Join waitlist"
      onNavCta={focusWaitlist}
      waitlist
      finalCtaLabel="Join the waitlist"
      finalCtaSubtitle="Get early access to your AI CMO. Join the waitlist and we'll let you in soon."
      onFinalCta={focusWaitlist}
    />
  );
}

interface LandingLayoutProps {
  hero: ReactNode;
  onNavCta: () => void;
  onFinalCta: () => void;
  navCtaLabel?: string;
  finalCtaLabel?: string;
  finalCtaSubtitle?: string;
  /** Invite-only page: login moves from the nav to the footer. */
  waitlist?: boolean;
}

function LandingLayout({
  hero,
  onNavCta,
  onFinalCta,
  navCtaLabel,
  finalCtaLabel,
  finalCtaSubtitle,
  waitlist = false,
}: LandingLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary selection:bg-white/10 selection:text-white">
      {/* 1. Navigation */}
      <LandingNav onGetStarted={onNavCta} ctaLabel={navCtaLabel} appLinks={!waitlist} />

      {/* 2 & 3. Hero (inline onboarding flow, or the waitlist) */}
      {hero}

      {/* 4. Section — What is Loop Launch? */}
      <WhatIsLoopLaunchSection />

      {/* 5. Section — How It Works */}
      <HowItWorksSection />

      {/* 6. Deep Research Section */}
      <DeepResearchSection />

      {/* 7. Strategic Intelligence Section */}
      <StrategicIntelligenceSection />

      {/* 8. Strategy Output Section */}
      <StrategyOutputSection />

      {/* 9. Final CTA */}
      <FinalCtaSection onGetStarted={onFinalCta} ctaLabel={finalCtaLabel} subtitle={finalCtaSubtitle} />

      {/* 11. Footer */}
      <LandingFooter inviteLogin={waitlist} />
    </div>
  );
}
