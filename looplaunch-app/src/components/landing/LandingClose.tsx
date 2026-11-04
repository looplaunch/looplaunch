"use client";

import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/seo";
import { smoothScrollTo } from "@/lib/smooth-scroll";

/** The landing page's footer: a purple field whose headline is the way to reach us. */
export function LandingClose({ inviteLogin = false }: { inviteLogin?: boolean }) {
  const email = siteConfig.links.contact;
  const [user, domain] = email.split("@");

  const toTop = (e: React.MouseEvent) => {
    e.preventDefault();
    const top = document.getElementById("hero-section");
    if (top) smoothScrollTo(top);
  };

  return (
    <footer className="ll-close ll-wrap" aria-labelledby="contact-title">
      <div className="ll-grid ll-close__top ll-small">
        <div className="ll-close__notes">
          <b className="text-[17px] font-semibold">Loop Launch</b>
          <span>Your AI CMO, in invite-only beta.</span>
          <span>Market. Reach. Repeat.</span>
        </div>
        <a href="#hero-section" onClick={toTop} className="ll-link underline">
          Back to top
        </a>
      </div>

      <h2 id="contact-title" className="sr-only-ll">
        Contact Loop Launch
      </h2>
      <div className="ll-close__bottom">
        <Image
          src="/loopy-cutout.webp"
          alt="Loopy, the Loop Launch mascot, holding a tablet and a pen"
          width={283}
          height={360}
          className="ll-close__loopy"
        />
        <a href={`mailto:${email}`} className="ll-close__mail" data-reveal>
        <span className="ll-display">
          <span className="ll-line">
            <span>{user}</span>
          </span>
        </span>
        <span className="ll-display">
          <span className="ll-line">
            <span>@{domain}</span>
          </span>
        </span>
        </a>
      </div>

      <div className="ll-close__meta ll-small">
        <nav aria-label="Legal">
          <Link href="/privacy" className="ll-link underline">
            Privacy
          </Link>
          <Link href="/terms" className="ll-link underline">
            Terms
          </Link>
          {inviteLogin && (
            <Link href="/login" className="ll-link underline">
              Log in (invite only)
            </Link>
          )}
        </nav>
        <span>Questions, ideas, or just hello: write to us.</span>
        <span>© {new Date().getFullYear()} Loop Launch</span>
      </div>
    </footer>
  );
}
