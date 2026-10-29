/**
 * Provider result cache. SerpApi and Tavily results are kept in Supabase (`research_cache`,
 * migration 007) and in memory, keyed by provider + operation + exact parameters, so
 * analysing the same market again reuses them instead of spending search credits.
 *
 * Results keep the time they were fetched, so cached data is never shown as new.
 * Without the table (migration not run yet) it quietly falls back to memory only.
 */

import { createHash } from "node:crypto";
import { getSupabase } from "@/lib/db/supabase";

const TABLE = "research_cache";

export interface CachedValue<T> {
  value: T;
  /** When the provider returned this data */
  fetchedAt: string;
}

export interface ResearchCache {
  get<T>(key: string): Promise<CachedValue<T> | null>;
  /** `meta` describes the entry in the database; memory-only writes can pass null. */
  set<T>(key: string, meta: { provider: string; operation: string; params: Record<string, unknown> } | null, value: T, ttlHours: number): Promise<CachedValue<T>>;
}

function sortedKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortedKeys((value as Record<string, unknown>)[k])])
    );
  }
  return value;
}

export function cacheKey(provider: string, operation: string, params: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify([provider, operation, sortedKeys(params)])).digest("hex");
}

/** In-memory only: used by tests, and as the first layer of the shared cache. */
export function createMemoryCache(now: () => number = Date.now): ResearchCache {
  const store = new Map<string, CachedValue<unknown> & { expiresAt: number }>();
  return {
    async get<T>(key: string) {
      const hit = store.get(key);
      if (!hit) return null;
      if (hit.expiresAt <= now()) {
        store.delete(key);
        return null;
      }
      return { value: hit.value as T, fetchedAt: hit.fetchedAt };
    },
    async set<T>(key: string, _meta: unknown, value: T, ttlHours: number) {
      const entry = { value, fetchedAt: new Date(now()).toISOString() };
      if (ttlHours > 0) store.set(key, { ...entry, expiresAt: now() + ttlHours * 3_600_000 });
      return entry;
    },
  };
}

const globalCache = globalThis as unknown as { __researchMemoryCache?: ResearchCache; __researchCacheTableMissingUntil?: number };

function tableMissing(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01" || error.code === "PGRST205" || /could not find the table|does not exist/i.test(error.message || "");
}

/** Memory first, then Supabase. Shared across requests in this server process. */
export function createResearchCache(): ResearchCache {
  const memory = (globalCache.__researchMemoryCache ??= createMemoryCache());
  const dbUsable = () => Boolean(getSupabase()) && (globalCache.__researchCacheTableMissingUntil ?? 0) < Date.now();
  const markMissing = () => {
    if ((globalCache.__researchCacheTableMissingUntil ?? 0) < Date.now()) {
      console.warn("[ResearchCache] research_cache table not found (run migration 007). Using memory only for now.");
    }
    globalCache.__researchCacheTableMissingUntil = Date.now() + 10 * 60_000;
  };

  return {
    async get<T>(key: string) {
      const fromMemory = await memory.get<T>(key);
      if (fromMemory || !dbUsable()) return fromMemory;
      try {
        const { data, error } = await getSupabase()!
          .from(TABLE)
          .select("response, fetched_at, expires_at")
          .eq("key", key)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();
        if (error) {
          if (tableMissing(error)) markMissing();
          else console.warn("[ResearchCache] read failed:", error.message);
          return null;
        }
        if (!data) return null;
        const hoursLeft = (new Date(data.expires_at as string).getTime() - Date.now()) / 3_600_000;
        await memory.set(key, null, data.response, hoursLeft);
        return { value: data.response as T, fetchedAt: data.fetched_at as string };
      } catch (e) {
        console.warn("[ResearchCache] read failed:", e instanceof Error ? e.message : e);
        return null;
      }
    },

    async set<T>(key: string, meta: { provider: string; operation: string; params: Record<string, unknown> } | null, value: T, ttlHours: number) {
      const entry = await memory.set(key, meta, value, ttlHours);
      if (!meta || ttlHours <= 0 || !dbUsable()) return entry;
      try {
        const { error } = await getSupabase()!.from(TABLE).upsert({
          key,
          provider: meta.provider,
          operation: meta.operation,
          params: meta.params,
          response: value,
          fetched_at: entry.fetchedAt,
          expires_at: new Date(Date.now() + ttlHours * 3_600_000).toISOString(),
        });
        if (error) {
          if (tableMissing(error)) markMissing();
          else console.warn("[ResearchCache] write failed:", error.message);
        }
      } catch (e) {
        console.warn("[ResearchCache] write failed:", e instanceof Error ? e.message : e);
      }
      return entry;
    },
  };
}
