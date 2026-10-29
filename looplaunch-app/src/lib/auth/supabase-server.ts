import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { hasSupabaseAuthConfig, supabaseAuthConfig } from "./config";

/** Supabase client for server code (route handlers, server components). Reads the login cookie. */
export async function createSupabaseServerClient() {
  const { url, key } = supabaseAuthConfig();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components can't set cookies. The proxy refreshes them on the next request.
        }
      },
    },
  });
}

/** The logged-in user for this request, or null if nobody is signed in. */
export async function getCurrentUser(): Promise<User | null> {
  if (!hasSupabaseAuthConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

/**
 * Who is signed in, from the login token, or null when signed out. getClaims() checks the
 * token locally, so this is cheap enough for the frequently polled API routes.
 */
export async function getSignedInClaims(): Promise<{ userId: string; email?: string } | null> {
  if (!hasSupabaseAuthConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { userId: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
}
