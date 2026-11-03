"use client";

import { useState } from "react";
import Stack from "@/components/reactbits/Stack";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";

/**
 * Loopy's notes as a small deck (React Bits Stack): the top card can be flicked or clicked to the
 * back, and the deck deals the next one by itself every few seconds unless the pointer rests on it.
 */
export function LoopyTipsDeck({ tips, className = "" }: { tips: string[]; className?: string }) {
  const [top, setTop] = useState(0);

  return (
    <section className={`rounded-[20px] bg-[#111114] p-5 sm:p-6 flex flex-col ${className}`} aria-labelledby="loopy-notes">
      <div className="flex items-center gap-3 mb-9">
        <LoopyMascot size={40} mood="hover" />
        <div className="min-w-0">
          <h2 id="loopy-notes" className="text-[15px] font-semibold text-[#F4F4F5]">
            Loopy&apos;s notes
          </h2>
          <p className="text-[12px] text-[#8B8B94] tabular-nums" aria-live="polite">
            {tips.length > 1 ? `${top + 1} of ${tips.length} · drag or tap for the next` : "Today's note"}
          </p>
        </div>
      </div>
      <div className="relative h-[124px] mt-auto pt-0">
        <Stack
          cards={tips.map((tip) => (
            <div key={tip} className="h-full w-full rounded-[16px] bg-[#1C1C21] p-4 flex items-center">
              <p className="text-[15px] leading-6 text-[#F4F4F5]">{tip}</p>
            </div>
          ))}
          layout="deck"
          visible={3}
          spread={0.35}
          depth={0.4}
          radius={16}
          shadow={false}
          tilt={12}
          sendToBackOnClick
          autoplay
          autoplayDelay={6000}
          pauseOnHover
          onChange={setTop}
        />
      </div>
    </section>
  );
}
