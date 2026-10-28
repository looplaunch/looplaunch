"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { LogoMenu } from "@/components/brand/LogoMenu";
import { AccountMenu } from "@/components/auth/AccountMenu";
import type { ProfileInfo } from "@/lib/auth/profile";

interface AppNavProps {
  profile: ProfileInfo | null;
  active?: "home" | "history" | "new" | "profile";
}

/** Top bar for signed-in pages: logo menu, Home / History, New analysis, account. */
export function AppNav({ profile, active }: AppNavProps) {
  const tab = (href: string, label: string, isActive: boolean) => (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
        isActive ? "text-[#F4F4F5] bg-[#17171B]" : "text-[#A1A1AA] hover:text-[#F4F4F5]"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 h-14 bg-[#09090B]/95 backdrop-blur-md border-b border-[#27272A]">
      <div className="mx-auto max-w-6xl h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <LogoMenu />
          {profile && (
            <nav className="hidden sm:flex items-center gap-1" aria-label="Main">
              {tab("/", "Home", active === "home")}
              {tab("/history", "History", active === "history")}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {profile && active !== "new" && (
            <Link
              href="/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#8B5CF6] text-white hover:bg-[#7C3AED] transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New analysis</span>
            </Link>
          )}
          <AccountMenu initialProfile={profile} />
        </div>
      </div>
    </header>
  );
}
