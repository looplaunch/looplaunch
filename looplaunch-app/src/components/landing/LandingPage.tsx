"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useOnboarding } from "@/lib/onboarding/context";
import { LandingNav } from "./LandingNav";
import { HeroSection } from "./HeroSection";
import { StepsSection } from "./StepsSection";
import { AskSection } from "./AskSection";
import { SwitchesSection } from "./SwitchesSection";
import { StartClosingLine, WaitlistClosingLine } from "./ClosingLine";
import { LandingClose } from "./LandingClose";
import { WaitlistHero } from "@/components/waitlist/WaitlistHero";
import { GameArena } from "@/components/waitlist/GameArena";
import { WaitlistGameProvider, useWaitlistGame } from "@/components/waitlist/WaitlistGame";
import { SmoothScroll } from "./SmoothScroll";
import "./landing.css";

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
    <LandingLayout
      hero={<HeroSection />}
      onNavCta={scrollToHero}
      closing={<StartClosingLine onStart={handleStartOnboarding} />}
    />
  );
}

/** The public landing page while Loop Launch is invite-only: same page, waitlist hero. Joining opens Loopy's snake over the page (with a skip). */
export function WaitlistLandingPage({ signedInEmail }: { signedInEmail?: string | null }) {
  return (
    <WaitlistGameProvider signedInEmail={signedInEmail}>
      <WaitlistLanding />
    </WaitlistGameProvider>
  );
}

function WaitlistLanding() {
  const { arena, openGame } = useWaitlistGame();

  return (
    <LandingLayout
      hero={<WaitlistHero />}
      navCtaLabel="Join waitlist"
      onNavCta={openGame}
      waitlist
      closing={<WaitlistClosingLine />}
      overlay={<GameArena />}
      inert={arena.open}
    />
  );
}

interface LandingLayoutProps {
  hero: ReactNode;
  onNavCta: () => void;
  /** The closing sentence before the footer */
  closing: ReactNode;
  navCtaLabel?: string;
  /** Invite-only page: login moves from the nav to the footer. */
  waitlist?: boolean;
  /** Drawn over the page (the snake game); `inert` takes the page out of reach while it's open. */
  overlay?: ReactNode;
  inert?: boolean;
}

function LandingLayout({ hero, onNavCta, closing, navCtaLabel, waitlist = false, overlay, inert = false }: LandingLayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useRevealOnScroll(rootRef);

  return (
    <div
      ref={rootRef}
      className={`ll font-sans min-h-svh flex flex-col selection:bg-white/10 selection:text-white`}
    >
      {/* The slow, smooth wheel scroll asked for on the landing page */}
      <SmoothScroll />

      <div className="contents" inert={inert}>
        <LandingNav onGetStarted={onNavCta} ctaLabel={navCtaLabel} appLinks={!waitlist} />
        <main>
          {hero}
          <StepsSection />
          <AskSection />
          <SwitchesSection />
          {closing}
        </main>
        <LandingClose inviteLogin={waitlist} />
      </div>

      {overlay}

    </div>
  );
}

/** Marks each [data-reveal] element with data-in the first time it scrolls into view (landing.css animates it). */
function useRevealOnScroll(rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    // A masked line sits below its clipping parent until it rises, so its parent is what's watched.
    const owner = new Map<Element, Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (owner.get(entry.target) ?? entry.target).setAttribute("data-in", "");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    const watch = () =>
      root.querySelectorAll("[data-reveal]:not([data-in])").forEach((el) => {
        const target = el.getAttribute("data-reveal") === "line" && el.parentElement ? el.parentElement : el;
        owner.set(target, el);
        io.observe(target);
      });
    watch();
    // Parts that mount later (the closing line after joining) are picked up too.
    const added = new MutationObserver(watch);
    added.observe(root, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      added.disconnect();
    };
  }, [rootRef]);
}
