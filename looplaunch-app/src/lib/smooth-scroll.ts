import type Lenis from "lenis";

let scroller: Lenis | null = null;

/** Set by the landing page's smooth scroller while it runs. */
export function setSmoothScroller(instance: Lenis | null) {
  scroller = instance;
}

/**
 * Scroll to an element (or the top) with the landing page's smooth scroller when it runs, natively
 * otherwise, so buttons that jump down the page glide with the same easing as the wheel.
 */
export function smoothScrollTo(target: HTMLElement | "top", { center = false }: { center?: boolean } = {}) {
  const el = target === "top" ? null : target;
  if (scroller) {
    const offset = el && center ? -(window.innerHeight / 2 - el.getBoundingClientRect().height / 2) : 0;
    scroller.scrollTo(el ?? 0, { offset });
    return;
  }
  if (!el) window.scrollTo({ top: 0, behavior: "smooth" });
  else el.scrollIntoView({ behavior: "smooth", block: center ? "center" : "start" });
}
