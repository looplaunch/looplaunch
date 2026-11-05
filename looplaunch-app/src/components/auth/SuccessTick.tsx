"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";

interface SuccessTickProps {
  /** Called once the tick has finished drawing and had a beat to land */
  onDone?: () => void;
  /** How long after mounting to call onDone, in ms */
  holdMs?: number;
}

const FILL = "#34D399";
const INK = "#04210F";

/** A green disc springs in, the tick draws itself across it, and one ring ripples outwards. */
export function SuccessTick({ onDone, holdMs = 1150 }: SuccessTickProps) {
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const t = window.setTimeout(() => done.current?.(), holdMs);
    return () => window.clearTimeout(t);
  }, [holdMs]);

  return (
    <div className="flex justify-center py-5" role="status" aria-label="Verified">
      <div className="relative h-[88px] w-[88px]">
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: FILL }}
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: [0.7, 1.55], opacity: [0.7, 0] }}
          transition={{ delay: 0.42, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        <svg viewBox="0 0 88 88" className="relative h-full w-full" aria-hidden="true">
          <motion.circle
            cx="44"
            cy="44"
            r="42"
            fill={FILL}
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.4 }}
          />
          <motion.path
            d="M26 45.5 38.5 58 62 33"
            fill="none"
            stroke={INK}
            strokeWidth="6.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.26, duration: 0.4, ease: [0.65, 0, 0.35, 1], opacity: { delay: 0.26, duration: 0.01 } }}
          />
        </svg>
      </div>
    </div>
  );
}
