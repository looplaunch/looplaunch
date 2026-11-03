import Link from "next/link";
import { ArrowRight, MessageSquare, Pencil } from "lucide-react";
import { AppNav } from "@/components/app/AppNav";
import { AnalysisStatusMark, openHref, statusText, timeAgo } from "@/components/app/AnalysisRow";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { pickTips } from "@/components/loopy/tips";
import { LoopyTipsDeck } from "./LoopyTipsDeck";
import { RecentAnalysesList } from "./RecentAnalysesList";
import { RollingCount } from "./RollingCount";
import { SetupChecklist } from "./SetupChecklist";
import { PipelineStrip } from "./PipelineStrip";
import { StartAnalysisForm } from "./StartAnalysisForm";
import type { ProfileInfo } from "@/lib/auth/profile";
import { displayDomain, type SessionSummary } from "@/lib/intelligence/summary";

interface DashboardProps {
  profile: ProfileInfo;
  sessions: SessionSummary[];
  /** True when `sessions` was cut off at the query's limit, so counts show "50+" */
  truncated?: boolean;
}

/*
 * Grid: a centred 1100px column of 12 columns with 16px gutters (12 x 77 + 11 x 16 = 1100).
 * Rows span 3+3+3+3 (counts), then 8+4 twice, so every internal edge meets one above it.
 * Surfaces separate by lightness alone: ground #09090B, panel #111114, row #1C1C21.
 * Purple sits on data only (pipeline bars, progress); the one primary control is a white pill.
 */

/** Home for signed-in users: a first-run setup with no analyses, a workspace after that. */
export function Dashboard({ profile, sessions, truncated = false }: DashboardProps) {
  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5]">
      <AppNav profile={profile} active="home" />
      <main className="mx-auto max-w-[1148px] px-4 sm:px-6 pt-10 sm:pt-14 pb-20">
        {sessions.length === 0 ? (
          <FirstRun profile={profile} />
        ) : (
          <Workspace profile={profile} sessions={sessions} truncated={truncated} />
        )}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────
// Shared pieces
// ──────────────────────────────────────────────

const panel = "rounded-[20px] bg-[#111114] p-5 sm:p-6";

function PanelTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <h2 className="text-[15px] font-semibold text-[#F4F4F5]">{children}</h2>
      {aside}
    </div>
  );
}

/** Loopy's notes: tips matched to what the latest analysis is about, dealt as a deck. */
function LoopyNote({ about, seed }: { about: string; seed: string }) {
  return <LoopyTipsDeck tips={pickTips(about, seed, 4)} className="flex-1" />;
}

// ──────────────────────────────────────────────
// State A: no analyses yet
// ──────────────────────────────────────────────

/** What the pipeline reads from a website, in the words the business profile uses. */
const READS = [
  ["What you sell", "Your products or services and the core offer"],
  ["Who buys it", "The audience your pages speak to"],
  ["Your industry", "The category you compete in"],
  ["How you position it", "The claims and promises on your site"],
] as const;

/** What each pipeline stage does, in the order of PIPELINE_STAGES (api/intelligence/gather). */
const STAGE_DETAILS = [
  "Crawls your pages for what's really on them",
  "Works out what you sell, to whom, and where",
  "Searches Google for competitors, their ads and buyers' questions",
  "Weighs the evidence and writes your diagnosis",
];

/** What a finished analysis contains (see api/intelligence/gather). */
const OUTPUTS = [
  ["Competitors and their ads", "Who ranks and advertises for your buyers, and what they say"],
  ["Your buyers' questions", "What people search before they buy, with answers"],
  ["A diagnosis", "Where your positioning is strong, and the gaps"],
  ["A 7-day plan", "The first moves, in order, and a chat to question it"],
] as const;

function FirstRun({ profile }: { profile: ProfileInfo }) {
  const steps = [
    { label: "Add your website", done: !!profile.companyWebsite },
    { label: "Run your first analysis", done: false },
    { label: "Ask Loopy a strategy question", done: false },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <>
      <header className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5 mb-10">
        <LoopyMascot size={72} />
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[30px] leading-tight font-semibold tracking-[-0.02em]">
            Your strategic intelligence starts here
          </h1>
          <p className="mt-2 text-[16px] leading-6 text-[#B4B4BC] max-w-[60ch]">
            Give Loop Launch your website and it studies your business, market and competitors, then builds your
            strategy.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className={`${panel} lg:col-span-8 lg:self-start`} aria-labelledby="connect-title">
          <h2 id="connect-title" className="text-[20px] font-semibold tracking-[-0.01em]">
            {profile.companyWebsite ? "Analyse your website" : "Connect your website"}
          </h2>
          <p className="mt-1 mb-5 text-[15px] leading-6 text-[#B4B4BC]">
            {profile.companyWebsite
              ? `We've filled in ${displayDomain(profile.companyWebsite)} from your profile. A few questions come next.`
              : "Start with your own site. A few questions come next, then the research runs."}
          </p>
          <StartAnalysisForm defaultWebsite={profile.companyWebsite} action="Start my analysis" />

          <h3 className="mt-8 mb-3 text-[13px] font-medium text-[#B4B4BC]">What Loop Launch reads from it</h3>
          <dl className="grid sm:grid-cols-2 gap-2">
            {READS.map(([term, detail]) => (
              <div key={term} className="rounded-[14px] bg-[#1C1C21] px-4 py-3">
                <dt className="text-[14px] font-medium">{term}</dt>
                <dd className="text-[13px] leading-5 text-[#B4B4BC] mt-0.5">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="lg:col-span-4 flex flex-col gap-4">
        <section className={panel} aria-labelledby="setup-title">
          <PanelTitle aside={<span className="text-[13px] text-[#B4B4BC] tabular-nums">{pct}%</span>}>
            <span id="setup-title">Getting started</span>
          </PanelTitle>
          <div className="h-1 rounded-full bg-[#2A2A30] mb-5" aria-hidden="true">
            <div className="h-full rounded-full bg-[#8B5CF6] origin-left bar-grow" style={{ width: `${pct}%` }} />
          </div>
          <SetupChecklist steps={steps} />
          {!profile.companyWebsite && (
            <Link href="/profile" className="inline-flex items-center gap-1.5 mt-4 text-[13px] text-[#B4B4BC] hover:text-[#F4F4F5]">
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              Save your website to your profile
            </Link>
          )}
        </section>
        <LoopyNote about="" seed={profile.email} />
        </div>

        <section className={`${panel} lg:col-span-12`} aria-labelledby="pipeline-title">
          <PanelTitle>
            <span id="pipeline-title">What happens when you start</span>
          </PanelTitle>
          <PipelineStrip labelled />
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-x-1.5 gap-y-3 mt-2">
            {STAGE_DETAILS.map((d) => (
              <li key={d} className="text-[13px] leading-5 text-[#B4B4BC] pr-2">
                {d}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[14px] leading-6 text-[#B4B4BC]">
            Loopy keeps you company while it works, and the progress shows here and in History.
          </p>
        </section>

        <section className={`${panel} lg:col-span-12`} aria-labelledby="outputs-title">
            <PanelTitle>
              <span id="outputs-title">What you&apos;ll get</span>
            </PanelTitle>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
              {OUTPUTS.map(([title, detail]) => (
                <li key={title}>
                  <p className="text-[14px] font-medium">{title}</p>
                  <p className="text-[13px] leading-5 text-[#B4B4BC] mt-0.5">{detail}</p>
                </li>
              ))}
            </ul>
        </section>
      </div>
    </>
  );
}

// ──────────────────────────────────────────────
// State B: returning user
// ──────────────────────────────────────────────

function Workspace({ profile, sessions, truncated }: { profile: ProfileInfo; sessions: SessionSummary[]; truncated: boolean }) {
  const [latest, ...rest] = sessions;
  const ready = sessions.filter((s) => s.status === "ready").length;
  const researching = sessions.filter((s) => s.status !== "ready" && s.status !== "error").length;
  const questions = sessions.reduce((n, s) => n + s.questionCount, 0);
  const plus = truncated ? "+" : "";
  const latestStatus = statusText(latest);

  const counts = [
    { label: "Analyses", value: sessions.length, more: plus, note: sessions.length === 1 ? "Your first one" : "In History" },
    { label: "Strategies ready", value: ready, more: plus, note: ready ? "Open to read or question" : "None finished yet" },
    { label: "Questions asked", value: questions, more: plus, note: questions ? "Across your analyses" : "Ask one in any analysis" },
    { label: "Researching now", value: researching, more: "", note: researching ? "Progress updates live" : "Nothing running" },
  ];

  const finding =
    latest.status === "ready"
      ? `${latest.companyName} is ready${latest.questionCount ? `, with ${latest.questionCount} question${latest.questionCount === 1 ? "" : "s"} asked so far` : ". Ask your first question"}.`
      : latest.status === "error"
        ? `${latest.companyName} didn't finish. Open it to see what went wrong, or run it again.`
        : `${latest.companyName} is still researching.`;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-[26px] sm:text-[30px] leading-tight font-semibold tracking-[-0.02em]">
            Welcome back, {profile.firstName}
          </h1>
          <p className="mt-2 text-[16px] leading-6 text-[#B4B4BC]">{finding}</p>
        </div>
        <Link
          href={openHref(latest)}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-[#F4F4F5] text-[#09090B] text-sm font-semibold hover:bg-white active:scale-[0.98] transition"
        >
          {latest.status === "ready" ? "Continue with " : "Open "}
          {latest.companyName}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {counts.map((c) => (
          <div key={c.label} className="rounded-[20px] bg-[#111114] p-4 sm:min-h-[128px] flex flex-col">
            <p className="text-[13px] text-[#B4B4BC]">{c.label}</p>
            <p className="mt-1 text-[28px] leading-9 font-normal tabular-nums">
              <RollingCount value={c.value} suffix={c.more || undefined} />
            </p>
            <p className="mt-auto pt-2 text-[12px] text-[#8B8B94]">{c.note}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <section className={`${panel} lg:col-span-8 flex flex-col`} aria-labelledby="latest-title">
          <PanelTitle aside={<span className="text-[13px] text-[#8B8B94]">Updated {timeAgo(latest.updatedAt).toLowerCase()}</span>}>
            <span id="latest-title">Latest analysis</span>
          </PanelTitle>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[22px] font-semibold tracking-[-0.01em] truncate">{latest.companyName}</p>
              <p className="text-[14px] text-[#B4B4BC] truncate">
                {[displayDomain(latest.website), latest.industry].filter(Boolean).join(" · ")}
              </p>
            </div>
            <span className={`flex items-center gap-1.5 text-[13px] font-medium shrink-0 ${latestStatus.tone}`}>
              <AnalysisStatusMark status={latest.status} size={16} />
              {latestStatus.label}
            </span>
          </div>
          <div className="mt-5">
            <PipelineStrip status={latest.status} labelled />
          </div>
          {latest.lastQuestion && (
            <div className="mt-5 rounded-[14px] bg-[#1C1C21] px-4 py-3">
              <p className="text-[12px] text-[#8B8B94]">Last question</p>
              <p className="text-[14px] leading-6 text-[#F4F4F5] line-clamp-2 mt-0.5">{latest.lastQuestion}</p>
            </div>
          )}
          <div className="mt-auto pt-5 flex flex-wrap gap-x-5 gap-y-2">
            <Link href={openHref(latest)} className="inline-flex items-center gap-1.5 text-[14px] font-medium hover:text-white group">
              Open analysis
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            {latest.status === "ready" && (
              <Link href={openHref(latest)} className="inline-flex items-center gap-1.5 text-[14px] text-[#B4B4BC] hover:text-[#F4F4F5]">
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                Ask a strategy question
              </Link>
            )}
          </div>
        </section>

        <div className="lg:col-span-4 flex flex-col gap-4">
          <section className={panel} aria-labelledby="business-title">
            <PanelTitle
              aside={
                <Link href="/profile" className="text-[13px] text-[#B4B4BC] hover:text-[#F4F4F5]">
                  Edit
                </Link>
              }
            >
              <span id="business-title">Your business</span>
            </PanelTitle>
            <dl className="space-y-3 text-[14px]">
              {[
                ["Company", profile.companyName],
                ["Website", displayDomain(profile.companyWebsite)],
                ["Your role", profile.jobTitle],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-[#B4B4BC]">{k}</dt>
                  <dd className={`truncate text-right ${v ? "text-[#F4F4F5]" : "text-[#8B8B94]"}`}>{v || "—"}</dd>
                </div>
              ))}
            </dl>
          </section>
          <LoopyNote about={`${latest.lastQuestion || ""} ${latest.industry}`} seed={latest.id} />
        </div>

        <section className={`${panel} lg:col-span-12 flex flex-col`} aria-labelledby="recent-title">
          <PanelTitle>
            <span id="recent-title">Earlier analyses</span>
          </PanelTitle>
          {rest.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-[#2E2E35] px-4 py-3 text-[14px] text-[#B4B4BC]">
              Only one analysis so far. Each one you run will be listed here.
            </p>
          ) : (
            <RecentAnalysesList sessions={rest.slice(0, 5)} />
          )}
          <div className="mt-auto pt-4 flex items-center justify-between text-[13px]">
            <span className="text-[#8B8B94] tabular-nums">
              {sessions.length}
              {plus} {sessions.length === 1 ? "analysis" : "analyses"} in total
            </span>
            <Link href="/history" className="inline-flex items-center gap-1 text-[#B4B4BC] hover:text-[#F4F4F5]">
              View all in History
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* A full-width bar, so no shorter card sits beside the list */}
        <section className={`${panel} lg:col-span-12 grid lg:grid-cols-12 gap-x-4 gap-y-4 items-end`} aria-labelledby="new-title">
          <div className="lg:col-span-5">
            <h2 id="new-title" className="text-[15px] font-semibold text-[#F4F4F5]">
              New analysis
            </h2>
            <p className="mt-1 text-[14px] leading-6 text-[#B4B4BC]">
              Run another site: a competitor, a new product, or yours again after changes.
            </p>
          </div>
          <div className="lg:col-span-7">
            <StartAnalysisForm action="Analyse" />
          </div>
        </section>
      </div>
    </>
  );
}
