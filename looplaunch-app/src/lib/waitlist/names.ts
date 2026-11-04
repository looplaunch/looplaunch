/** The longest first name the leaderboard shows. */
export const FIRST_NAME_MAX = 20;

/**
 * A first name as the leaderboard shows it: the first word only, kept to letters, digits,
 * apostrophes and hyphens, at most FIRST_NAME_MAX characters. A name typed all in lower or upper
 * case gets one capital ("rhythm" and "RHYTHM" become "Rhythm"); mixed case is kept ("DeShawn").
 */
export function cleanFirstName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const word = raw.trim().split(/\s+/)[0] ?? "";
  const letters = Array.from(word.replace(/[^\p{L}\p{M}\p{N}'’-]/gu, "")).slice(0, FIRST_NAME_MAX);
  const name = letters.join("");
  const lower = name.toLocaleLowerCase();
  if (name !== lower && name !== name.toLocaleUpperCase()) return name;
  const [first = "", ...rest] = Array.from(lower);
  return first.toLocaleUpperCase() + rest.join("");
}

// Names the public board won't show. Whole names only, except a few roots that start no real name.
// Kept short on purpose: real first names (Shital, Nazia, Anal, Dick) must never be refused.
const BLOCKED_NAMES = new Set([
  "ass", "asshole", "bastard", "bollocks", "boobs", "cock", "dickhead", "kkk", "nazi", "penis",
  "porn", "pussy", "rape", "sex", "shit", "shithead", "slut", "tits", "twat", "wank", "wanker",
]);
const BLOCKED_ROOTS = ["bitch", "cunt", "fagg", "fuck", "hitler", "motherf", "nigg", "rapist", "retard", "whore"];

export function isBlockedName(name: string): boolean {
  const plain = name.toLowerCase().replace(/[^a-z]/g, "");
  return BLOCKED_NAMES.has(plain) || BLOCKED_ROOTS.some((root) => plain.startsWith(root));
}
