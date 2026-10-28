/**
 * Runs before page and API requests. Refreshes the Supabase login cookie so people
 * stay signed in, and passes the refreshed cookie on to the server code that reads it.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthConfig, supabaseAuthConfig } from "@/lib/auth/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabaseAuthConfig()) return response;
  const { url, key } = supabaseAuthConfig();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims() refreshes an expired token (which calls setAll above) and checks it
  // locally when the project signs tokens with asymmetric keys, so it is fast.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Pages only. API routes check the login themselves, and static files never need it,
  // so the frequent status polling doesn't pay for an auth round trip each time.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
