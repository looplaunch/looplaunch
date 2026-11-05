import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { AnimatedHeight } from "@/components/ui/AnimatedHeight";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";

interface AuthShellProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

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
          <div className="ll-card rounded-[20px] bg-[#111114] p-6 sm:p-8">
            <AnimatedHeight>
              <div className="ll-rise" style={delay(0.1)}>
                <LoopyMascot size={44} mood="float" />
              </div>
              <div className="ll-rise" style={delay(0.16)}>
                {/* Keyed so a new step's title fades in instead of snapping */}
                <div key={title} className="ll-swap">
                  <h1 className="mt-4 text-[26px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
                  <p className="mt-2 text-[15px] leading-[1.5] text-[#B4B4BC]">{subtitle}</p>
                </div>
              </div>
              <div className="mt-6">{children}</div>
            </AnimatedHeight>
          </div>

          <p className="ll-rise mt-5 px-2 text-center text-[13px] leading-relaxed text-[#8B8B94]" style={delay(0.55)}>
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
