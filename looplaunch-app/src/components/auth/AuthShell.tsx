import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";

interface AuthShellProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

/** The login and password pages: the wordmark home, then one panel with Loopy, the title and the form. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="min-h-svh bg-[#09090B] text-[#F4F4F5] flex flex-col">
      <header className="h-14 shrink-0">
        <div className="mx-auto max-w-[1148px] h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <Link href="/" className="rounded-md">
            <Image src="/logo.png" alt="Loop Launch home" width={145} height={48} className="h-8 w-auto object-contain" priority />
          </Link>
          <Link href="/" className="text-[14px] text-[#B4B4BC] hover:text-white transition-colors">
            Back to the site
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center px-4 pt-6 pb-16 sm:py-16">
        <div className="w-full max-w-[400px]">
          <div className="rounded-[20px] bg-[#111114] p-6 sm:p-8">
            <LoopyMascot size={44} />
            <h1 className="mt-4 text-[26px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
            <p className="mt-2 text-[15px] leading-[1.5] text-[#B4B4BC]">{subtitle}</p>
            <div className="mt-6">{children}</div>
          </div>

          <p className="mt-5 px-2 text-center text-[13px] leading-relaxed text-[#8B8B94]">
            By continuing you agree to our{" "}
            <Link href="/terms" className="text-[#B4B4BC] underline underline-offset-2 hover:text-white">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[#B4B4BC] underline underline-offset-2 hover:text-white">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
