"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { LoopyMascot } from "./LoopyMascot";
import { pickLoopyTip } from "./tips";

/**
 * Loopy pops up beside a fresh answer with a one-line piece of advice.
 * The tip is picked to match what the answer talks about, so it feels relevant.
 */

interface LoopyTipProps {
  content: string;
  seed: string;
}

export function LoopyTip({ content, seed }: LoopyTipProps) {
  const reduce = useReducedMotion();
  const tip = pickLoopyTip(content, seed);
  const [open, setOpen] = useState(true);
  const [count, setCount] = useState(0);
  const typed = reduce ? tip : tip.slice(0, count);

  // Type the tip out like Loopy is saying it.
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => {
      setCount((c) => {
        if (c >= tip.length) {
          clearInterval(t);
          return c;
        }
        return c + 1;
      });
    }, 22);
    return () => clearInterval(t);
  }, [tip, reduce]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="flex items-end gap-3 mb-4"
          role="note"
          aria-label="Tip from Loopy"
        >
          <motion.div
            initial={reduce ? undefined : { rotate: -12, y: 8 }}
            animate={{ rotate: 0, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.05 }}
          >
            <LoopyMascot size={60} />
          </motion.div>

          <div className="relative flex-1 min-w-0 max-w-xl bg-[#1C1C21] rounded-2xl rounded-bl-sm px-4 py-3">
            {/* bubble tail */}
            <span aria-hidden="true" className="absolute -left-[6px] bottom-3 w-3 h-3 rotate-45 bg-[#1C1C21]" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[13px] font-medium text-[#B4B4BC] mb-1">Loopy says</span>
                <p className="text-[14px] leading-relaxed text-[#F4F4F5]">
                  <span className="sr-only">{tip}</span>
                  <span aria-hidden="true">
                    {typed}
                    {typed.length < tip.length && <span className="inline-block w-[2px] h-[1em] align-[-2px] ml-0.5 bg-[#B4B4BC]" />}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 w-7 h-7 -mr-1.5 -mt-1 rounded-full flex items-center justify-center text-[#8B8B94] hover:text-white hover:bg-[#2A2A30] transition-colors cursor-pointer"
                aria-label="Dismiss Loopy's tip"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
