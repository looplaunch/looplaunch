"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { PRIMARY_INLINE, SECONDARY_INLINE } from "@/components/ui/fields";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-svh bg-[#09090B] text-[#F4F4F5] flex items-center justify-center p-6">
      <div className="max-w-sm text-center flex flex-col items-center">
        <LoopyMascot size={72} mood="still" />
        <h1 className="mt-5 text-[22px] leading-tight font-semibold tracking-[-0.01em]">Something went wrong</h1>
        <p className="mt-2 text-[15px] leading-[1.5] text-[#B4B4BC]">
          Loopy tripped over something. Try again, and if it keeps happening, head home.
        </p>
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={() => retry()} className={PRIMARY_INLINE}>
            Try again
          </button>
          <Link href="/" className={SECONDARY_INLINE}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
