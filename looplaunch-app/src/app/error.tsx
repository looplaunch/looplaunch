"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex items-center justify-center p-6">
      <div className="max-w-sm text-center flex flex-col items-center">
        <LoopyMascot size={72} mood="still" />
        <h1 className="mt-5 text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-[#A1A1AA]">Loopy tripped over something. Try again, and if it keeps happening, head home.</p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => retry()}
            className="px-4 py-2 rounded-lg bg-[#F4F4F5] text-[#09090B] text-sm font-medium hover:bg-white transition-colors cursor-pointer"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-[#3F3F46] text-sm font-medium text-[#F4F4F5] hover:bg-[#17171B] transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
