"use client";

import { forwardRef } from "react";
import { AnimatePresence, motion } from "motion/react";

export type JoinPhase = "idle" | "sending" | "done";

interface JoinButtonProps {
  phase: JoinPhase;
  label: string;
  doneTitle: string;
  doneNote: string;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The form's submit button. Sending, it shrinks into a spinning circle; once saved, the circle
 * fills, a tick draws itself across it, a ring ripples out and the confirmation rises underneath.
 */
export const JoinButton = forwardRef<HTMLButtonElement, JoinButtonProps>(function JoinButton(
  { phase, label, doneTitle, doneNote },
  ref
) {
  const round = phase !== "idle";

  return (
    <div className="mt-6 flex flex-col items-center">
      <motion.button
        ref={ref}
        type="submit"
        disabled={round}
        aria-label={phase === "sending" ? "Saving" : phase === "done" ? doneTitle : undefined}
        initial={false}
        animate={{
          width: round ? 64 : "100%",
          height: round ? 64 : 52,
          borderRadius: round ? 32 : 12,
          backgroundColor: phase === "done" ? "#34D399" : "#8B5CF6",
        }}
        whileHover={round ? undefined : { scale: 1.015, backgroundColor: "#7C3AED" }}
        whileTap={round ? undefined : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 32, backgroundColor: { duration: 0.25 } }}
        className="group relative flex items-center justify-center overflow-visible text-[15px] font-semibold text-white disabled:cursor-default"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {phase === "idle" && (
            <motion.span
              key="label"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
              className="inline-flex items-center gap-2 whitespace-nowrap"
            >
              {label}
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="h-4 w-4 fill-none stroke-current stroke-2 transition-transform duration-200 group-hover:translate-x-1"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 10h12M11 5l5 5-5 5" />
              </svg>
            </motion.span>
          )}
          {phase === "sending" && (
            <motion.span
              key="spinner"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1, rotate: 360 }}
              exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.12 } }}
              transition={{ rotate: { repeat: Infinity, duration: 0.8, ease: "linear" }, default: { duration: 0.2 } }}
              className="block h-6 w-6 rounded-full border-[3px] border-white/30 border-t-white"
            />
          )}
          {phase === "done" && (
            <motion.svg key="tick" viewBox="0 0 56 56" className="h-16 w-16" aria-hidden="true">
              <motion.path
                d="M17 29 25 37 40 21"
                fill="none"
                stroke="#04210F"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.12, duration: 0.42, ease: [0.65, 0, 0.35, 1] }}
              />
            </motion.svg>
          )}
        </AnimatePresence>

        {phase === "done" && (
          <>
            {[0, 1].map((i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#34D399]"
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2.1, opacity: 0 }}
                transition={{ delay: 0.3 + i * 0.22, duration: 0.9, ease: EASE }}
              />
            ))}
            <Sparks />
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {phase === "done" && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 12, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            transition={{ delay: 0.4, duration: 0.45, ease: EASE }}
            className="overflow-hidden text-center"
          >
            <p className="pt-4 text-lg font-semibold text-text-primary">{doneTitle}</p>
            <p className="mt-1 text-sm text-text-secondary">{doneNote}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/** Little squares that fly off the tick as it lands. */
function Sparks() {
  return (
    <span className="pointer-events-none absolute inset-0" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const reach = 46 + (i % 3) * 10;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 -ml-1 -mt-1 h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: i % 3 === 0 ? "#34D399" : i % 3 === 1 ? "#8B5CF6" : "#EDEDEF" }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
            animate={{ x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, opacity: 0, scale: 0.4, rotate: 200 }}
            transition={{ delay: 0.35, duration: 0.8, ease: EASE }}
          />
        );
      })}
    </span>
  );
}
