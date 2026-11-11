"use client";

import Image from "next/image";
import Link from "next/link";
import { LogoMenu } from "@/components/brand/LogoMenu";
import { smoothScrollTo } from "@/lib/smooth-scroll";

interface LandingNavProps {
  onGetStarted?: () => void;
  /** Text of the purple button, e.g. "Join waitlist" while the site is invite-only. */
  ctaLabel?: string;
  /**
   * The waitlist page sets this to false: no "Log in" link (the team logs in from the
   * footer) and a plain logo, since the logo menu offers to start an analysis.
   */
  appLinks?: boolean;
}

const LINKS = [
  { label: "How it works", id: "how-it-works" },
  { label: "Ask it", id: "ask" },
  { label: "What you get", id: "features" },
];

export function LandingNav({ onGetStarted, ctaLabel = "Get started", appLinks = true }: LandingNavProps) {
  const jump = (e: React.MouseEvent, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    smoothScrollTo(target);
  };

  const logo = (
    <Image src="/logo.png" alt="Loop Launch" width={145} height={48} className="h-8 w-auto object-contain sm:h-9" priority />
  );

  return (
    <header className="ll-nav">
      <div className="ll-wrap ll-nav__bar">
        {appLinks ? <LogoMenu>{logo}</LogoMenu> : <Link href="/">{logo}</Link>}

        <nav className="ll-nav__links ll-small" aria-label="Main">
          {LINKS.map((link) => (
            <a key={link.id} href={`#${link.id}`} onClick={(e) => jump(e, link.id)} className="ll-link">
              {link.label}
            </a>
          ))}
          {appLinks && (
            <Link href="/login" className="ll-link ll-nav__login">
              Log in
            </Link>
          )}
          <button type="button" onClick={onGetStarted} className="ll-button">
            {ctaLabel}
          </button>
        </nav>
      </div>
    </header>
  );
}
