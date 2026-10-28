import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { AppNav } from "@/components/app/AppNav";
import { SessionCard } from "@/components/app/SessionCard";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import type { ProfileInfo } from "@/lib/auth/profile";
import type { SessionSummary } from "@/lib/intelligence/summary";

const TIPS = [
  "Answer the question your buyers google most. One clear page can bring traffic for years.",
  "Post the video that scares you a little. Safe content rarely gets shared.",
  "Read your competitors' 1-star reviews. That's your to-do list, written by their customers.",
  "Done this week beats perfect next month. Pick the first step and ship it today.",
  "Measure one number this week. If it doesn't move, change the plan, not the goal.",
  "Talk to one customer before you build anything new. They'll save you weeks.",
  "If a stranger can't repeat your one-liner, it's not done yet. Test it on three people today.",
];

/** A different tip each day. */
function tipOfTheDay(): string {
  return TIPS[Math.floor(Date.now() / 86_400_000) % TIPS.length];
}

interface DashboardProps {
  profile: ProfileInfo;
  sessions: SessionSummary[];
}

/** Home page for signed-in users: start something new or jump back into an analysis. */
export function Dashboard({ profile, sessions }: DashboardProps) {
  const [latest, ...rest] = sessions;
  const tip = tipOfTheDay();

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5]">
      <AppNav profile={profile} active="home" />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10 space-y-10">
        <section className="relative overflow-hidden rounded-2xl border border-[#27272A] bg-gradient-to-br from-[#1A1426] via-[#111114] to-[#111114] p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
            <LoopyMascot size={84} />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Welcome back, {profile.firstName}</h1>
              <p className="text-[#A1A1AA] mt-1.5 max-w-xl">
                {latest
                  ? "Pick up where you left off, or point Loopy at a new website."
                  : "Give Loopy a website and get a 7-day plan built on what your buyers actually search."}
              </p>
            </div>
            <Link
              href="/new"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium text-sm transition-colors shrink-0"
            >
              <Plus className="w-4 h-4" />
              Start a new analysis
            </Link>
          </div>
        </section>

        {latest ? (
          <section>
            <h2 className="text-[15px] font-semibold mb-3">Continue where you left off</h2>
            <SessionCard session={latest} featured />
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-[#27272A] p-8 text-center">
            <p className="text-[15px] font-medium">No analyses yet</p>
            <p className="text-sm text-[#A1A1AA] mt-1">Your analyses will show up here, so you can come back and keep chatting.</p>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[15px] font-semibold">Recent analyses</h2>
              <Link href="/history" className="inline-flex items-center gap-1 text-sm text-[#A1A1AA] hover:text-[#F4F4F5]">
                See all
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[#FF4FB4]/25 bg-[#111114] p-5 flex items-start gap-4">
          <LoopyMascot size={40} mood="still" />
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#FF4FB4]">Loopy&apos;s tip for today</p>
            <p className="text-[14px] text-[#E4E4E7] mt-1 leading-relaxed">{tip}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
