"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type State = "idle" | "loading" | "done";

/** A thin line across the top from a link click until the new page shows (globals.css .ll-progress). */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const url = `${pathname}?${search}`;
  const [state, setState] = useState<State>("idle");

  // The address changes when the new page commits: that's the finish.
  const [shownUrl, setShownUrl] = useState(url);
  if (url !== shownUrl) {
    setShownUrl(url);
    if (state === "loading") setState("done");
  }

  useEffect(() => {
    // Capture phase: <Link> cancels the click's default to navigate in place, so it can't be skipped here.
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const to = new URL(link.href, location.href);
      if (to.origin !== location.origin || (to.pathname === location.pathname && to.search === location.search)) return;
      setState("loading");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (state === "idle") return;
    // "done" clears once its fade has played; a navigation that never lands gives up after a while.
    const timer = setTimeout(() => setState(state === "done" ? "idle" : "done"), state === "done" ? 600 : 12000);
    return () => clearTimeout(timer);
  }, [state]);

  return <div className="ll-progress" data-state={state} aria-hidden="true" />;
}
