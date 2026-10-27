"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { LoopyMascot } from "./LoopyMascot";

/**
 * Loopy pops up beside a fresh answer with a one-line piece of advice.
 * The tip is picked to match what the answer talks about, so it feels relevant.
 */

const TIPS: { match: RegExp; tips: string[] }[] = [
  {
    match: /(tiktok|reels?|shorts?|short-form|video|hook)/i,
    tips: [
      "Your first 3 seconds decide everything. Film the hook five ways and post the best one.",
      "Post the video that scares you a little. Safe content rarely gets shared.",
      "Batch-film on one day, post all week. Consistency beats perfection.",
    ],
  },
  {
    match: /(outbound|cold email|dm|linkedin|founder-led|sales)/i,
    tips: [
      "Send 10 personal messages before you automate 1,000. Learn what lands first.",
      "Lead with their problem, not your product. Nobody replies to a feature list.",
    ],
  },
  {
    match: /(position|messag|value prop|differentiat|tagline)/i,
    tips: [
      "If a stranger can't repeat your one-liner, it's not done yet. Test it on three people today.",
      "Pick one thing you're best at and say it everywhere. Being everything means being forgettable.",
    ],
  },
  {
    match: /(competitor|rival|moat|versus|vs\.)/i,
    tips: [
      "Read your competitors' 1-star reviews. That's your roadmap, written by their customers.",
      "Don't copy competitors. Find the gap they're ignoring and own it.",
    ],
  },
  {
    match: /(seo|search|google|keyword|blog)/i,
    tips: [
      "Write the answer your customer googles at 2am. That page will work for years.",
    ],
  },
  {
    match: /(ads?|paid|cpc|budget|meta|roas)/i,
    tips: [
      "Prove it organically before you pay to scale it. Ads amplify, they don't fix.",
    ],
  },
  {
    match: /(funnel|conversion|landing page|checkout|signup)/i,
    tips: [
      "Remove one field from your signup form today. Every click you cut is money back.",
    ],
  },
];

const GENERAL_TIPS = [
  "Don't do all of this at once. Pick the first step and ship it today.",
  "Done this week beats perfect next month. Start with the smallest step.",
  "Measure one number this week. If it doesn't move, change the plan, not the goal.",
  "Talk to one customer before you build anything new. They'll save you weeks.",
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickLoopyTip(content: string, seed: string): string {
  const matched = TIPS.find((t) => t.match.test(content));
  const pool = matched ? matched.tips : GENERAL_TIPS;
  return pool[hash(seed) % pool.length];
}

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
            <LoopyMascot size={60} mood="wave" />
          </motion.div>

          <div className="relative flex-1 min-w-0 max-w-xl bg-[#111114] border border-[#FF4FB4]/30 rounded-2xl rounded-bl-sm px-4 py-3 shadow-[0_0_24px_-8px_rgba(255,79,180,0.35)]">
            {/* bubble tail */}
            <span
              aria-hidden="true"
              className="absolute -left-[7px] bottom-3 w-3 h-3 rotate-45 bg-[#111114] border-l border-b border-[#FF4FB4]/30"
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="block text-[10px] font-mono uppercase tracking-wider text-[#FF4FB4] mb-1">
                  Loopy says
                </span>
                <p className="text-[13.5px] leading-relaxed text-[#F4F4F5]">
                  <span className="sr-only">{tip}</span>
                  <span aria-hidden="true">
                    {typed}
                    {typed.length < tip.length && (
                      <span className="inline-block w-[2px] h-[1em] align-[-2px] ml-0.5 bg-[#FF4FB4] animate-pulse" />
                    )}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 text-[#71717A] hover:text-[#F4F4F5] transition-colors cursor-pointer p-0.5"
                aria-label="Dismiss Loopy's tip"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
