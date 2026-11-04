/**
 * What this browser remembers about its own waitlist entry, so a returning visitor sees that
 * they're on the list and can save a faster time in one click. Kept in localStorage, which can
 * throw (private mode, blocked storage): then it lasts until the tab closes.
 */

export interface Me {
  firstName: string;
  email: string;
  entryId: string | null;
  bestMs: number | null;
  rank: number | null;
}

const KEY = "ll_waitlist_me_v1";
const listeners = new Set<() => void>();
let unsaved: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? unsaved;
  } catch {
    return unsaved;
  }
}

export function subscribeMe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export const readMe = () => read();
export const readMeOnServer = () => null;

export function parseMe(raw: string | null): Me | null {
  if (!raw) return null;
  try {
    const me = JSON.parse(raw) as Partial<Me>;
    return typeof me.email === "string" && typeof me.firstName === "string" ? (me as Me) : null;
  } catch {
    return null;
  }
}

export function saveMe(me: Me) {
  unsaved = JSON.stringify(me);
  try {
    localStorage.setItem(KEY, unsaved);
  } catch {
    // Storage blocked: `unsaved` keeps it for this visit.
  }
  listeners.forEach((listener) => listener());
}
