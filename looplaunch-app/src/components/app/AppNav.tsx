"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import PillNav from "@/components/reactbits/PillNav";
import { LogoMenu } from "@/components/brand/LogoMenu";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { APP_HEADER_STYLE } from "@/components/app/PageTransition";
import type { ProfileInfo } from "@/lib/auth/profile";

interface AppNavProps {
  /** undefined while a page loads (AppSkeleton): the bar shows its links and the avatar fills in from the session. */
  profile: ProfileInfo | null | undefined;
  active?: "home" | "history" | "new" | "profile";
}

/** Top bar for signed-in pages: logo menu, Home / History, New analysis, account. */
export function AppNav({ profile, active }: AppNavProps) {
  const activeHref = active === "home" ? "/" : active === "history" ? "/history" : undefined;

  return (
    <header className="sticky top-0 z-40 h-14 bg-[#09090B] border-b border-[#1C1C21]" style={APP_HEADER_STYLE}>
      <div className="mx-auto max-w-[1148px] h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <LogoMenu />
          {profile !== null && (
            // React Bits PillNav: a white fill rises through a link as its label rolls over; a purple dot marks the page
            <div className="hidden sm:block">
              <PillNav
                items={[
                  { label: "Home", href: "/" },
                  { label: "History", href: "/history" },
                ]}
                activeHref={activeHref ?? ""}
                linkComponent={Link}
                size="sm"
                surface="none"
                collapse="never"
                itemStyle="plain"
                hoverEffect="fill"
                indicator="dot"
                intro={false}
                highlightColor="#F4F4F5"
                highlightTextColor="#09090B"
                textColor="#9A9AA3"
                style={{ "--pn-pill-shadow": "none", "--pn-dot": "#8B5CF6", "--pn-strong": "#F4F4F5" } as CSSProperties}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {profile !== null && active !== "new" && (
            <Link
              href="/new"
              className="group inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium text-[#F4F4F5] border border-[#3F3F48] hover:border-[#71717A] hover:bg-[#17171B] active:scale-[0.96] transition"
            >
              <Plus className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
              <span className="hidden sm:inline">New analysis</span>
            </Link>
          )}
          <AccountMenu initialProfile={profile} />
        </div>
      </div>
    </header>
  );
}
