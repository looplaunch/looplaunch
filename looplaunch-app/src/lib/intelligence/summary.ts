import type { ChatMessage, PipelineStatus } from "./types";

/** What the dashboard and History list show for one analysis. */
export interface SessionSummary {
  id: string;
  companyName: string;
  website: string;
  status: PipelineStatus;
  createdAt: string;
  updatedAt: string;
  /** Questions the user typed (the built-in strategy prompts don't count) */
  questionCount: number;
  lastQuestion?: string;
}

/** Built-in prompts the app sends by itself; they aren't questions the user asked. */
const AUTO_PROMPT_PREFIXES = [
  "Build a prioritized 7-Day execution strategy for",
  "Build a comprehensive 14-Day marketing and growth strategy for",
];

export function isAutoPrompt(content: string): boolean {
  return AUTO_PROMPT_PREFIXES.some((p) => content.startsWith(p));
}

export function userQuestions(messages: ChatMessage[] = []): string[] {
  return messages.filter((m) => m.role === "user" && !isAutoPrompt(m.content)).map((m) => m.content);
}

/** "https://www.racksup.in/shop" → "racksup.in" */
export function displayDomain(website?: string): string {
  return (website || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
}
