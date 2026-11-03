"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { setSmoothScroller } from "@/lib/smooth-scroll";

/** The landing page's slow, smooth wheel scroll. Touch keeps native scrolling; reduced motion turns it off. */
export function SmoothScroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ lerp: 0.1, anchors: true, autoRaf: true });
    setSmoothScroller(lenis);
    return () => {
      setSmoothScroller(null);
      lenis.destroy();
    };
  }, []);

  return null;
}
