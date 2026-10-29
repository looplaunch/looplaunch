/**
 * Buyer questions from Google's "People also ask" boxes. Only questions Google actually
 * showed are kept here; AI answers are attached later and labelled as AI.
 */

import { createHash } from "node:crypto";
import type { PeopleAlsoAskQuestion } from "./serpapi";

export interface FoundQuestion extends PeopleAlsoAskQuestion {
  /** The search that showed this question */
  sourceQuery: string;
  observedAt: string;
}

export interface SelectedQuestion extends FoundQuestion {
  id: string;
}

const STOP_WORDS = new Set(["a", "an", "the", "is", "are", "do", "does", "to", "of", "for", "in", "on", "and", "or", "what", "which", "how", "i", "my", "it", "can", "you"]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function tokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(" ")
      .filter((w) => w && !STOP_WORDS.has(w))
      .map((w) => (w.length > 3 ? w.replace(/s$/, "") : w))
  );
}

/** "Is iPhone worth it?" vs "is the iphone worth it" are the same question. */
export function isNearDuplicate(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  // No "contains" rule: "best phone?" and "best phone for gaming?" are different questions.
  if (na === nb) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared) >= 0.75;
}

/**
 * Does the question share a meaningful word with the search that showed it or with the
 * business context? Google sometimes mixes in unrelated questions ("What do people do
 * 144 times a day?" on a phone search). Word parts count: "phone" matches "smartphones".
 */
export function isRelevant(question: string, context: string[]): boolean {
  const words = (text: string) => [...tokens(text)].filter((w) => w.length >= 4);
  const asked = words(question);
  const about = context.flatMap(words);
  if (asked.length === 0 || about.length === 0) return true;
  return asked.some((a) => about.some((b) => a.includes(b) || b.includes(a)));
}

/** Up to `max` distinct, relevant questions, in the order Google showed them. */
export function selectQuestions(found: FoundQuestion[], max: number, context: string[] = []): SelectedQuestion[] {
  const out: SelectedQuestion[] = [];
  for (const q of found) {
    if (out.length >= max) break;
    if (!q.question.trim() || out.some((kept) => isNearDuplicate(kept.question, q.question))) continue;
    if (!isRelevant(q.question, [q.sourceQuery, ...context])) continue;
    out.push({ ...q, id: `q_${createHash("sha1").update(normalize(q.question)).digest("hex").slice(0, 12)}` });
  }
  return out;
}
