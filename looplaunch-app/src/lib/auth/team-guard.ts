import { NextResponse } from "next/server";
import { getSignedInClaims } from "./supabase-server";
import { canUseApp, isWaitlistOn } from "./team";

/**
 * For API routes: a 403 response while the waitlist is on and the caller isn't on the team,
 * or null to carry on. Keeps strangers from spending SerpApi/Gemini credits.
 */
export async function rejectIfNoAccess(): Promise<NextResponse | null> {
  // Everyone has access once the waitlist is off, so there's no need to read the login.
  if (!isWaitlistOn()) return null;
  if (canUseApp((await getSignedInClaims())?.email)) return null;
  return NextResponse.json({ error: "Loop Launch is invite-only for now. Join the waitlist at looplaunch.co." }, { status: 403 });
}
