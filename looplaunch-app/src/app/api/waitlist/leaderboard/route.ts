/**
 * GET /api/waitlist/leaderboard
 *
 * The snake game's leaderboard: the fastest ten first names and times, plus how many people hold
 * each time so the page can rank a run as it's played. Public; emails never leave the server.
 * `board` is null while the leaderboard isn't set up (migration 008) or the database is down.
 */

import { NextResponse } from "next/server";
import { BoardNotSetUpError, readBoard, waitlistStore } from "@/lib/waitlist/board";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  const store = waitlistStore();
  if (!store) return NextResponse.json({ board: null }, { headers: NO_STORE });
  try {
    return NextResponse.json({ board: await readBoard(store) }, { headers: NO_STORE });
  } catch (error) {
    if (!(error instanceof BoardNotSetUpError)) {
      console.error("[Waitlist] Leaderboard read failed:", error instanceof Error ? error.message : error);
    }
    return NextResponse.json({ board: null }, { headers: NO_STORE });
  }
}
