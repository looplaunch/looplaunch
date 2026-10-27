"use client";

import { motion, useReducedMotion } from "motion/react";

export const LOOPY_SRC = "/loopy.png";

interface LoopyMascotProps {
  size?: number;
  className?: string;
  /** "float" bobs gently; "wave" adds a little head tilt, used beside the speech bubble. */
  mood?: "float" | "wave" | "still";
}

/**
 * Loopy, the Loop Launch mascot, with a soft idle animation.
 * Respects prefers-reduced-motion.
 */
export function LoopyMascot({ size = 64, className = "", mood = "float" }: LoopyMascotProps) {
  const reduce = useReducedMotion();
  const animate =
    reduce || mood === "still"
      ? undefined
      : mood === "wave"
        ? { y: [0, -6, 0], rotate: [0, -6, 4, 0] }
        : { y: [0, -5, 0], rotate: [-2, 2, -2] };

  return (
    <motion.div
      className={`relative shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      animate={animate}
      transition={{ duration: mood === "wave" ? 2.2 : 3.6, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden="true"
    >
      {/* neon glow behind Loopy */}
      <div className="absolute inset-[12%] rounded-full bg-[#FF4FB4]/25 blur-xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOOPY_SRC}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="relative w-full h-full object-contain rounded-full"
      />
    </motion.div>
  );
}
