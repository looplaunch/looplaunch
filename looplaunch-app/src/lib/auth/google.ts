import { createSupabaseBrowserClient } from "./supabase-browser";

/**
 * Sends the browser to Google sign-in; it comes back to `next` (a same-site path) afterwards.
 * Resolves to an error message if it couldn't start, or null while the redirect happens.
 */
export async function startGoogleSignIn(next: string): Promise<string | null> {
  const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  return error ? error.message : null;
}
