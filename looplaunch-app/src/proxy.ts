/**
 * Runs before page requests. Refreshes the Supabase login cookie so people stay signed
 * in, and passes the refreshed cookie on to the server code that reads it.
 *
 * While the waitlist is on it is also the gate: anyone not on the team allowlist
 * (src/lib/auth/team.ts) is sent to the waitlist at "/" from every other page.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseAuthConfig, supabaseAuthConfig } from "@/lib/auth/config";
import { canUseApp } from "@/lib/auth/team";

/** Pages anyone may open: the waitlist itself, login, and files for search engines and browsers. */
const PUBLIC_PATHS = ["/", "/login", "/privacy", "/terms", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/auth/");
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isPublic = isPublicPath(request.nextUrl.pathname);
  // Without the Supabase settings nobody can log in, so only an open (no waitlist) app lets people in.
  if (!hasSupabaseAuthConfig()) {
    return isPublic || canUseApp(null) ? response : NextResponse.redirect(new URL("/", request.url));
  }
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
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (isPublic || canUseApp(email)) return response;

  // Not on the team: back to the waitlist, keeping any refreshed login cookie.
  const redirect = NextResponse.redirect(new URL("/", request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Pages only. API routes check the login themselves, and static files never need it,
  // so the frequent status polling doesn't pay for an auth round trip each time.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
