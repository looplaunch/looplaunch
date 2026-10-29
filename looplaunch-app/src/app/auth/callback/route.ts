import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { safeNextPath } from "@/lib/auth/redirect";

/**
 * Google sign-in and password reset links come back here with a one-time code.
 * Swap it for a login cookie, then continue to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  // A reset link fails when it has expired or was opened in a different browser.
  const failure = next === "/reset-password" ? "reset" : "auth";
  return NextResponse.redirect(new URL(`/login?error=${failure}`, origin));
}
