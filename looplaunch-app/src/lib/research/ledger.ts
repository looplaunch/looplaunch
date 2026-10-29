/**
 * Request ledger and budget for one research run.
 *
 * Every provider request is recorded (provider, operation, query, purpose, cache hit,
 * success, duration) and saved to `research_requests` (migration 007) for the session.
 * The budget caps how many requests each purpose may plan, cached or not, so a run can
 * never grow past the configured limits.
 *
 * Credit cost isn't recorded per request: SerpApi doesn't report it per search. The free
 * Account API reports monthly totals instead.
 */

import { getSupabase } from "@/lib/db/supabase";

export type Provider = "serpapi" | "tavily";
export type Purpose = "competitor_discovery" | "competitor_ads" | "ad_library" | "market_evidence" | "location_lookup";

export interface LedgerEntry {
  provider: Provider;
  operation: string;
  query: string;
  purpose: Purpose;
  cacheHit: boolean;
  success: boolean;
  /** Failure kind and message, when it failed */
  error?: string;
  durationMs: number;
  at: string;
}

export class ResearchLedger {
  readonly entries: LedgerEntry[] = [];
  private readonly planned = new Map<Purpose, number>();

  constructor(
    readonly sessionId: string | undefined,
    private readonly limits: Partial<Record<Purpose, number>>
  ) {}

  /** Reserve one request for `purpose`. False when its budget is used up. */
  take(purpose: Purpose): boolean {
    const limit = this.limits[purpose];
    const used = this.planned.get(purpose) ?? 0;
    if (limit !== undefined && used >= limit) return false;
    this.planned.set(purpose, used + 1);
    return true;
  }

  remaining(purpose: Purpose): number {
    const limit = this.limits[purpose];
    return limit === undefined ? Infinity : Math.max(0, limit - (this.planned.get(purpose) ?? 0));
  }

  record(entry: Omit<LedgerEntry, "at">): void {
    this.entries.push({ ...entry, at: new Date().toISOString() });
  }

  /** Requests that reached the provider, came from the cache, or failed. */
  counts(provider: Provider): { network: number; cached: number; failed: number } {
    const mine = this.entries.filter((e) => e.provider === provider);
    return {
      network: mine.filter((e) => !e.cacheHit && e.success).length,
      cached: mine.filter((e) => e.cacheHit).length,
      failed: mine.filter((e) => !e.success).length,
    };
  }

  /** Save the entries for this session. Never throws; skips quietly without the table. */
  async persist(): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || this.entries.length === 0) return;
    try {
      const { error } = await supabase.from("research_requests").insert(
        this.entries.map((e) => ({
          session_id: this.sessionId ?? null,
          provider: e.provider,
          operation: e.operation,
          query: e.query,
          purpose: e.purpose,
          cache_hit: e.cacheHit,
          success: e.success,
          error: e.error ?? null,
          duration_ms: e.durationMs,
          created_at: e.at,
        }))
      );
      if (error) console.warn("[ResearchLedger] Couldn't save request log:", error.message);
    } catch (e) {
      console.warn("[ResearchLedger] Couldn't save request log:", e instanceof Error ? e.message : e);
    }
  }
}
