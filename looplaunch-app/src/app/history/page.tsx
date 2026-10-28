import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { AppNav } from "@/components/app/AppNav";
import { SessionCard } from "@/components/app/SessionCard";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { profileOf } from "@/lib/auth/profile";
import { listSessionSummaries } from "@/lib/intelligence/store";

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/history");

  const sessions = await listSessionSummaries(user.id);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5]">
      <AppNav profile={profileOf(user)} active="history" />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">History</h1>
            <p className="text-sm text-[#A1A1AA] mt-1">Every analysis you&apos;ve run. Open one to keep chatting with Loopy about it.</p>
          </div>
          <Link
            href="/new"
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F4F4F5] text-[#09090B] text-sm font-medium hover:bg-white transition-colors"
          >
            <Plus className="w-4 h-4" />
            New analysis
          </Link>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#27272A] p-8 text-center">
            <p className="text-sm text-[#A1A1AA]">No analyses yet. Start one and it will show up here.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {sessions.map((s) => (
              <li key={s.id}>
                <SessionCard session={s} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
