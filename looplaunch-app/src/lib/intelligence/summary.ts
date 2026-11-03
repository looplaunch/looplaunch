import type { ChatMessage, PipelineStatus } from "./types";

/** What the dashboard and History list show for one analysis. */
export interface SessionSummary {
  id: string;
  companyName: string;
  website: string;
  /** From the onboarding answers; empty when they skipped it */
  industry: string;
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

/** "Daydrip's", but "Otterbrook Roasters'" */
export function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name}'` : `${name}'s`;
}

/** "https://www.racksup.in/shop" → "racksup.in" */
export function displayDomain(website?: string): string {
  return (website || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0];
}

/** The four stages the research pipeline (api/intelligence/gather) moves through, in order. */
export const PIPELINE_STAGES = ["Read the website", "Profile the business", "Research the market", "Diagnose"] as const;

/** How many of PIPELINE_STAGES are finished for this status (4 when the strategy is ready). */
export function stagesDone(status: PipelineStatus): number {
  switch (status) {
    case "ready":
      return 4;
    case "analyzing_market":
    case "diagnosing":
      return 3;
    case "crawling_competitors":
    case "researching_market":
    case "analyzing_competitors":
      return 2;
    case "analyzing_company":
      return 1;
    default:
      return 0;
  }
}
