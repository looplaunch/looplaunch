import { createBrowserClient } from "@supabase/ssr";
import { supabaseAuthConfig } from "./config";

/** Supabase client for client components: login, sign-out and reading the current user. */
export function createSupabaseBrowserClient() {
  const { url, key } = supabaseAuthConfig();
  return createBrowserClient(url, key);
}
