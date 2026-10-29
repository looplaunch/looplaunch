import Link from "next/link";
import type { ReactNode } from "react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";

interface AuthShellProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

/** The centered card around the login and password pages. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#111114] border border-[#27272A] rounded-xl p-7 shadow-lg">
        <div className="flex flex-col items-center text-center mb-6">
          <LoopyMascot size={56} />
          <h1 className="mt-3 text-lg font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-[#A1A1AA]">{subtitle}</p>
        </div>

        {children}

        <p className="mt-6 text-center text-[11px] leading-relaxed text-[#52525B]">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-[#A1A1AA]">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-[#A1A1AA]">
            Privacy Policy
          </Link>
          .
        </p>
        <Link href="/" className="block mt-3 text-center text-xs text-[#71717A] hover:text-[#F4F4F5] transition-colors">
          ← Back to Loop Launch
        </Link>
      </div>
    </div>
  );
}
