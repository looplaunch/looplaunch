"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/** Room around the content so focus rings and shakes aren't cut off by the clipping. */
const BLEED = 8;

/** Eases its height to fit its content whenever the content changes size, instead of snapping. */
export function AnimatedHeight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  // `ease` is false for the first measurement: it only replaces "auto", and animating it would grow the card on load.
  const [size, setSize] = useState<{ height: number; ease: boolean } | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize((prev) => ({ height: entry.borderBoxSize[0].blockSize + BLEED * 2, ease: prev !== null })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const instant = !size?.ease || reduce;

  return (
    <motion.div
      className={className}
      style={{ overflow: "hidden", margin: -BLEED, padding: BLEED }}
      initial={false}
      animate={{ height: size?.height ?? "auto" }}
      transition={instant ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}
