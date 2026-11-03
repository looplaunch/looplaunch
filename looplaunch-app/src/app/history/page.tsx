import { redirect } from "next/navigation";
import { HistoryView } from "@/components/app/HistoryView";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { profileOf } from "@/lib/auth/profile";
import { listSessionSummaries } from "@/lib/intelligence/store";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/history");

  const sessions = await listSessionSummaries(user.id);
  return <HistoryView profile={profileOf(user)} sessions={sessions} />;
}
