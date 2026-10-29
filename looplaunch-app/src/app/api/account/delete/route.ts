/**
 * POST /api/account/delete
 *
 * Body: { confirm: "DELETE" }
 * Permanently deletes the signed-in person's account: their analyses and chats, any
 * waitlist entry for their email, and the login itself. Open to every signed-in person,
 * team or not, so anyone can remove their data.
 */

import { NextResponse } from "next/server";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/auth/supabase-server";
import { getSupabase } from "@/lib/db/supabase";
import { deleteSessionsForUser } from "@/lib/intelligence/store";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Confirmation missing." }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "You're not logged in." }, { status: 401 });
  }

  const admin = getSupabase();
  if (!admin) {
    return NextResponse.json({ error: "Account deletion is unavailable right now. Please try again later." }, { status: 503 });
  }

  // Analyses go before the login: once it's deleted they'd lose their owner and become anonymous.
  const [sessionsDeleted, waitlist] = await Promise.all([
    deleteSessionsForUser(user.id),
    user.email ? admin.from("waitlist").delete().eq("email", user.email.toLowerCase()) : null,
  ]);
  if (waitlist?.error) console.warn("[Account] Waitlist cleanup failed:", waitlist.error.message);
  if (!sessionsDeleted) {
    return NextResponse.json({ error: "Couldn't delete your analyses. Your account is still there; please try again." }, { status: 500 });
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[Account] Deleting user failed:", error.message);
    return NextResponse.json(
      { error: "Your analyses were deleted, but the account couldn't be. Please try again." },
      { status: 500 }
    );
  }

  // Clear the login cookie in this browser too (the account behind it is gone).
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});

  return NextResponse.json({ ok: true });
}
