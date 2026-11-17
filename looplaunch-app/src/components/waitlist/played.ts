/**
 * Whether this browser has had its one go at Loopy's snake, and the finished run if it isn't
 * claimed yet (so a reload doesn't lose it). A go counts from the first move. Kept in
 * localStorage; when that's blocked it lasts until the tab closes.
 */

import type { FinishedRun } from "@/lib/waitlist/snake";

export interface Played {
  at: number;
  /** A finished run that isn't on the waitlist yet. */
  run: FinishedRun | null;
}

const KEY = "ll_waitlist_played_v1";
const listeners = new Set<() => void>();
let unsaved: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? unsaved;
  } catch {
    return unsaved;
  }
}

export function subscribePlayed(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export const readPlayed = () => read();
export const readPlayedOnServer = () => null;

export function parsePlayed(raw: string | null): Played | null {
  if (!raw) return null;
  try {
    const played = JSON.parse(raw) as Partial<Played>;
    if (typeof played.at !== "number") return null;
    const run = played.run;
    const valid = run && typeof run.seed === "number" && Array.isArray(run.turns) && typeof run.timeMs === "number";
    return { at: played.at, run: valid ? run : null };
  } catch {
    return null;
  }
}

export function savePlayed(played: Played) {
  unsaved = JSON.stringify(played);
  try {
    localStorage.setItem(KEY, unsaved);
  } catch {
    // Storage blocked: `unsaved` keeps it for this visit.
  }
  listeners.forEach((listener) => listener());
}
