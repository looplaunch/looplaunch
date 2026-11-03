import Link from "next/link";
import { AppNav } from "@/components/app/AppNav";
import { AnalysisRow, HISTORY_COLUMNS } from "@/components/app/AnalysisRow";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import type { ProfileInfo } from "@/lib/auth/profile";
import type { SessionSummary } from "@/lib/intelligence/summary";

const NEW_BUTTON =
  "inline-flex items-center gap-2 h-10 px-5 rounded-full bg-[#F4F4F5] text-[#09090B] text-sm font-semibold hover:bg-white active:scale-[0.98] transition shrink-0";

/** Every analysis the user has run, newest first; each row reopens its chat. */
export function HistoryView({ profile, sessions }: { profile: ProfileInfo; sessions: SessionSummary[] }) {
  const ready = sessions.filter((s) => s.status === "ready").length;

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5]">
      <AppNav profile={profile} active="history" />
      <main className="mx-auto max-w-[1148px] px-4 sm:px-6 pt-10 sm:pt-14 pb-20">
        {/* The top bar already carries New analysis, so the header only names the page */}
        <header className="mb-8">
          <h1 className="text-[26px] sm:text-[30px] leading-tight font-semibold tracking-[-0.02em]">History</h1>
          <p className="mt-2 text-[16px] leading-6 text-[#B4B4BC]">
            {sessions.length === 0
              ? "Every analysis you run is kept here, with its chat."
              : `${sessions.length} ${sessions.length === 1 ? "analysis" : "analyses"}, ${ready} with a strategy ready. Open one to keep asking Loopy about it.`}
          </p>
        </header>

        {sessions.length === 0 ? (
          <section className="rounded-[20px] bg-[#111114] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5" aria-labelledby="empty-title">
            <LoopyMascot size={56} />
            <div className="flex-1 min-w-0">
              <h2 id="empty-title" className="text-[20px] font-semibold">
                No analyses yet
              </h2>
              <p className="mt-1 text-[14px] leading-6 text-[#B4B4BC]">
                Give Loop Launch a website and the research runs. The finished analysis and its chat wait for you here.
              </p>
            </div>
            <Link href="/new" className={NEW_BUTTON}>
              Start an analysis
            </Link>
          </section>
        ) : (
          <section className="rounded-[20px] bg-[#111114] p-2 sm:p-3" aria-label="Your analyses">
            <div className={`hidden sm:grid ${HISTORY_COLUMNS} gap-x-4 pl-4 pr-14 pt-1 pb-2.5 text-[12px] text-[#8B8B94]`} aria-hidden="true">
              <span>Analysis</span>
              <span>Research</span>
              <span className="text-right">Questions</span>
              <span className="text-right">Status</span>
            </div>
            <ul className="space-y-2">
              {sessions.map((s, i) => (
                <li key={s.id} className="row-in" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                  <AnalysisRow session={s} detailed />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
