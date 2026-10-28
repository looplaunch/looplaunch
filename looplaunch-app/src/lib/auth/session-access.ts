import type { IntelligenceSession } from "@/lib/intelligence/types";
import { getCurrentUser } from "./supabase-server";

/**
 * Can the current request use this analysis?
 * Analyses with no owner stay open by session ID (anonymous use, as before).
 * Analyses with an owner only open for that owner.
 */
export async function canUseSession(session: IntelligenceSession): Promise<boolean> {
  if (!session.userId) return true;
  const user = await getCurrentUser();
  return user?.id === session.userId;
}
