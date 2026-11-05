import { ViewTransition, type ReactNode } from "react";

/**
 * Wraps a page's outermost element: React only animates an enter or exit when no DOM node sits above
 * the boundary. The old page fades out as the new one fades in (globals.css .page-out / .page-in),
 * while the top bar, named "app-header", is held still.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}

/** For the top bar of every app page, so page changes leave it in place. */
export const APP_HEADER_STYLE = { viewTransitionName: "app-header" } as const;
