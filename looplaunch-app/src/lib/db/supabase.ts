/**
 * Supabase Client — Singleton connection for server-side operations.
 *
 * Uses the service_role key for full table access from API routes.
 * Falls back gracefully if credentials are not configured.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ──────────────────────────────────────────────
// Singleton Client (HMR-safe)
// ──────────────────────────────────────────────

const globalForSupabase = globalThis as unknown as {
  __supabaseClient?: SupabaseClient;
};

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn(
      "[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined. Database operations will fall back to in-memory mode."
    );
    return null;
  }

  if (!globalForSupabase.__supabaseClient) {
    globalForSupabase.__supabaseClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return globalForSupabase.__supabaseClient;
}

/**
 * Get the Supabase client instance (or null if not configured).
 */
export function getSupabase(): SupabaseClient | null {
  return getSupabaseClient();
}

/**
 * Check if the Supabase connection is alive.
 */
export async function checkSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  database?: string;
}> {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return {
        ok: false,
        message: "Supabase credentials are not configured.",
      };
    }

    // Simple health check: query the sessions table
    const { error } = await client
      .from("sessions")
      .select("id")
      .limit(1);

    if (error) {
      return {
        ok: false,
        message: `Supabase connection error: ${error.message}`,
      };
    }

    return {
      ok: true,
      message: "Connected to Supabase successfully",
      database: "looplaunch",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Supabase connection error: ${msg}` };
  }
}
