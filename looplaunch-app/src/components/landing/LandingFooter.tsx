"use client";

import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/seo";

interface LandingFooterProps {
  /** Adds the team's way in while the site is invite-only. */
  inviteLogin?: boolean;
}

const LINK = "hover:text-text-primary transition-colors";

export function LandingFooter({ inviteLogin = false }: LandingFooterProps) {
  return (
    <footer className="w-full bg-bg-primary border-t border-border-subtle/40 py-12 px-6 sm:px-8 text-text-secondary text-sm">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Brand */}
        <div className="flex items-center gap-3 select-none">
          <Image
            src="/logo.png"
            alt="Loop Launch"
            width={120}
            height={40}
            className="h-7 w-auto object-contain"
          />
          <span className="text-xs text-text-tertiary ml-1">
            &copy; {new Date().getFullYear()}
          </span>
        </div>

        {/* Links. Section links start with "/" so they also work from the legal pages. */}
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-8 text-xs sm:text-sm">
          <Link href="/#what-is-it" className={LINK}>
            Product
          </Link>
          <Link href="/#how-it-works" className={LINK}>
            How it works
          </Link>
          <Link href="/#strategy-output" className={LINK}>
            Strategy
          </Link>
          <a href={`mailto:${siteConfig.links.contact}`} className={LINK}>
            Contact
          </a>
          <Link href="/privacy" className={LINK}>
            Privacy
          </Link>
          <Link href="/terms" className={LINK}>
            Terms
          </Link>
          {inviteLogin && (
            <Link href="/login" className={LINK}>
              Login (invite only)
            </Link>
          )}
        </nav>
      </div>
    </footer>
  );
}
