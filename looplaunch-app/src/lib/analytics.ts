type EventParams = Record<string, string | number | boolean>;

declare global {
  interface Window {
    gtag?: (command: "event", name: string, params?: EventParams) => void;
  }
}

/** Sends a Google Analytics event when the tag is loaded (production only); does nothing otherwise. */
export function track(name: string, params?: EventParams) {
  try {
    window.gtag?.("event", name, params);
  } catch {
    // Analytics must never break the page.
  }
}
