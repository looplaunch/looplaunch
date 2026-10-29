import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing/LandingFooter";

interface LegalPageProps {
  title: string;
  updated: string;
  intro: ReactNode;
  children: ReactNode;
}

/** Shared layout for the Privacy Policy and Terms pages. */
export function LegalPage({ title, updated, intro, children }: LegalPageProps) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <header className="border-b border-border-subtle">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/">
            <Image src="/logo.png" alt="Loop Launch" width={120} height={40} className="h-7 w-auto object-contain" />
          </Link>
          <Link href="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            ← Back to Loop Launch
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-text-tertiary">Last updated {updated}</p>
        <div className="mt-6 text-[15px] leading-relaxed text-text-secondary">{intro}</div>
        <div className="mt-10 space-y-9">{children}</div>
      </main>

      <LandingFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary mb-3">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-text-secondary [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2 [&_strong]:text-text-primary [&_strong]:font-medium [&_a]:text-text-primary [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </section>
  );
}
