"use client";

import { motion } from "motion/react";
import { Lock } from "lucide-react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { PRIMARY_INLINE } from "@/components/ui/fields";
import type { SearchIntelCounts } from "@/lib/intelligence/types";

interface LockedResultsProps {
  companyName: string;
  counts?: SearchIntelCounts;
  onLogIn: () => void;
}

/** The research is done but the visitor is signed out: what was found, in numbers, and a way to log in. */
export function LockedResults({ companyName, counts, onLogIn }: LockedResultsProps) {
  const found = counts
    ? [
        { n: counts.competitors, label: counts.competitors === 1 ? "competitor" : "competitors" },
        { n: counts.ads, label: counts.ads === 1 ? "ad" : "ads" },
        { n: counts.questions, label: counts.questions === 1 ? "buyer question" : "buyer questions" },
      ]
    : [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="my-auto flex flex-col items-center py-16 text-center"
      aria-labelledby="locked-title"
    >
      <LoopyMascot size={72} mood="wave" />
      <h1 id="locked-title" className="mt-5 text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px] [text-wrap:balance]">
        Your analysis of {companyName} is ready
      </h1>
      <p className="mt-3 max-w-[46ch] text-[16px] leading-relaxed text-[#B4B4BC]">
        Log in to see your 7-day strategy, the competitors Loopy found, and what your buyers ask Google.
      </p>

      {found.length > 0 && (
        <ul className="mt-8 grid w-full max-w-md grid-cols-3 gap-2" aria-label="What the research found">
          {found.map((f, i) => (
            <motion.li
              key={f.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
              className="rounded-2xl bg-[#111114] px-3 py-4"
            >
              <span className="block text-[28px] font-semibold tabular-nums leading-none">{f.n}</span>
              <span className="mt-1.5 block text-[13px] text-[#B4B4BC]">{f.label}</span>
            </motion.li>
          ))}
        </ul>
      )}

      <button type="button" onClick={onLogIn} className={`${PRIMARY_INLINE} mt-8`}>
        <Lock className="h-4 w-4" aria-hidden="true" />
        Log in to see your results
      </button>
    </motion.section>
  );
}
