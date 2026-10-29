"use client";

import Image from "next/image";
import { GooeyNav, type GooeyNavItem } from "@/components/ui/GooeyNav";
import Link from "next/link";
import { LogoMenu } from "@/components/brand/LogoMenu";

interface LandingNavProps {
  onGetStarted?: () => void;
  /** Text of the purple button, e.g. "Join waitlist" while the site is invite-only. */
  ctaLabel?: string;
  /**
   * The waitlist page sets this to false: no "Log in" button (the team logs in from the
   * footer) and a plain logo, since the logo menu offers to start an analysis.
   */
  appLinks?: boolean;
}

const NAV_ITEMS: GooeyNavItem[] = [
  { label: "Product", href: "#what-is-it" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Strategy", href: "#strategy-output" },
];

export function LandingNav({ onGetStarted, ctaLabel = "Get started", appLinks = true }: LandingNavProps) {
  const scrollToHero = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onGetStarted) {
      onGetStarted();
    } else {
      const heroInput = document.getElementById("hero-website-input");
      if (heroInput) {
        heroInput.scrollIntoView({ behavior: "smooth", block: "center" });
        heroInput.focus();
      }
    }
  };

  const handleNavItemClick = (item: GooeyNavItem) => {
    if (item.href.startsWith("#")) {
      const targetId = item.href.slice(1);
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const logo = (
    <Image
      src="/logo.png"
      alt="Loop Launch"
      width={145}
      height={48}
      className="h-8 sm:h-9 w-auto object-contain"
      priority
    />
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border-subtle bg-black/85 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-8">
        {/* Brand: Official Loop Launch Logo (opens the "where to next?" menu) */}
        <div className="z-[52]">
          {appLinks ? <LogoMenu>{logo}</LogoMenu> : <Link href="/">{logo}</Link>}
        </div>

        {/* Center / Right navigation: GooeyNav integration */}
        <div className="hidden sm:flex items-center z-[51]">
          <GooeyNav
            items={NAV_ITEMS}
            particleCount={10}
            particleDistances={[70, 8]}
            particleR={80}
            initialActiveIndex={0}
            animationTime={450}
            timeVariance={180}
            colors={[1, 2, 3, 1, 2, 3]}
            onItemClick={handleNavItemClick}
          />
        </div>

        {/* Right CTA Button */}
        <div className="flex items-center gap-3 z-[52]">
          {appLinks && (
            <Link
              href="/login"
              className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-[#D4D4D8] hover:text-white hover:bg-white/5 transition-colors"
            >
              Log in
            </Link>
          )}
          <button
            onClick={scrollToHero}
            className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium bg-[#8B5CF6] text-white hover:bg-[#7C3AED] border border-[#8B5CF6]/50 active:scale-95 transition-all cursor-pointer"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </header>
  );
}

