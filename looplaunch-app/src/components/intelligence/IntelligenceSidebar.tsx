"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { ExternalLink, ChevronDown, Search, MessageCircle, RotateCcw, Lock, ImageOff } from "lucide-react";
import type { CompetitorCategory, KeywordAdResult, SearchIntelCounts, SearchIntelView } from "@/lib/intelligence/types";
import { possessive } from "@/lib/intelligence/summary";
import RubberSegment from "@/components/reactbits/RubberSegment";
import Counter from "@/components/reactbits/Counter";

interface IntelligenceSidebarProps {
  /** Built on the server from stored research; switching tabs never searches again. */
  intel: SearchIntelView;
  companyName: string;
  sessionId: string;
  /** Send a question to Loopy in the main chat. */
  onAsk?: (question: string) => void;
  isAsking?: boolean;
  /** Opens the login pop-up from the locked sidebar. */
  onUnlock?: () => void;
}

type Tab = "questions" | "ads" | "competitors";
type AdGroup = "competitor" | "other" | "own";

type QuickAnswer =
  | { state: "loading" }
  | { state: "done"; answer: string; tip?: string }
  | { state: "error"; message: string };

const CATEGORY_LABEL: Record<string, string> = {
  direct: "Direct rival",
  indirect: "Indirect",
  marketplace: "Marketplace",
  publisher: "Publisher",
};

const PURPOSE_LABEL: Record<string, string> = {
  competitor_discovery: "Finding competitors",
  competitor_ads: "Competitor ads",
  ad_library: "Ad Library",
  market_evidence: "Web research",
};

/** Host of a URL or of a Google "displayed link" such as "https://www.bestbuy.com › phones". */
function domainOf(url?: string): string {
  if (!url) return "";
  const host = url.trim().replace(/^https?:\/\//i, "").split(/[\s›/?#]/)[0] || "";
  return host.toLowerCase().replace(/^www\./, "");
}

/** Search snippets can carry markdown or page furniture; keep plain sentences. */
function plainText(text?: string): string {
  return (text || "").replace(/[#*_`>|]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Only show a price when it actually looks like one ("From $799", "₹1,299", "$12/month"). */
function realPrice(p?: string): string | null {
  if (!p) return null;
  const clean = plainText(p);
  return clean.length <= 40 && /[$₹£€]\s?\d|\d\s?(usd|inr|rs)\b/i.test(clean) ? clean : null;
}

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

/** The picked tab or chip slides to its new place; the list under it swaps with a short fade and lift. */
const SLIDE = { type: "spring", stiffness: 500, damping: 40 } as const;
const SWAP = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.55, 0.055, 0.675, 0.19] } },
} as const;

const googleSearch = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-2">
      <h3 className="text-[14px] font-semibold text-[#F4F4F5]">{children}</h3>
      {hint && <span className="text-[12px] text-[#8B8B94] shrink-0">{hint}</span>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-4 rounded-xl bg-[#1C1C21] text-center text-[13px] text-[#B4B4BC] leading-relaxed">
      {children}
    </p>
  );
}

/** Research status in plain words, with the real collection date. */
function statusOf(intel: SearchIntelView): { dot: string; label: string } {
  const date = fmtDate(intel.dataCollectedAt || intel.completedAt);
  if (intel.status === "unavailable") return { dot: "#F87171", label: "Research unavailable" };
  if (intel.status === "empty") return { dot: "#8B8B94", label: "No relevant results found" };
  if (intel.status === "legacy") return { dot: "#8B8B94", label: date ? `Older analysis · ${date}` : "Older analysis" };
  if (intel.status === "partial") return { dot: "#FBBF24", label: date ? `Partial results · ${date}` : "Partial results" };
  if (intel.cachedSearches > 0 && intel.cachedSearches === intel.totalSearches) {
    return { dot: "#8B8B94", label: date ? `Saved results from ${date}` : "Saved results" };
  }
  return { dot: "#8B5CF6", label: date ? `From Google · ${date}` : "From Google" };
}

/** What signed-out visitors see instead of the search intel: what was found, in words, and a way to log in. */
function LockedIntel({ companyName, counts, onUnlock }: { companyName: string; counts: SearchIntelCounts; onUnlock?: () => void }) {
  const found = [
    counts.questions > 0 && `${plural(counts.questions, "question")} buyers ask Google`,
    counts.ads > 0 && `${plural(counts.ads, "competitor ad")} in this market`,
    counts.competitors > 0 && plural(counts.competitors, "competitor"),
  ].filter(Boolean) as string[];
  const summary =
    found.length > 0
      ? `Loopy found ${found.length > 1 ? `${found.slice(0, -1).join(", ")} and ${found[found.length - 1]}` : found[0]} for ${companyName}.`
      : `See what ${possessive(companyName)} buyers search on Google and who's competing for them.`;

  return (
    <div className="flex-1 px-4 pb-5 pt-1">
      <div className="rounded-[14px] bg-[#1C1C21] px-4 py-5">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#F4F4F5]">
          <Lock className="w-4 h-4 text-[#B4B4BC] shrink-0" aria-hidden="true" />
          Log in to see the search intel
        </h3>
        <p className="mt-2 text-[13px] text-[#B4B4BC] leading-relaxed">{summary}</p>
        <button
          type="button"
          onClick={onUnlock}
          className="mt-4 inline-flex items-center h-9 px-4 rounded-full bg-[#F4F4F5] text-[#09090B] text-[13px] font-semibold hover:bg-white active:scale-[0.98] transition cursor-pointer"
        >
          Log in
        </button>
      </div>
    </div>
  );
}

/** One search ad as buyers saw it, with every search it showed up on. */
function SearchAdCard({ ad }: { ad: KeywordAdResult }) {
  const domain = ad.advertiserDomain || domainOf(ad.displayedLink) || domainOf(ad.link);
  const queries = (ad.observations?.length ? ad.observations.map((o) => o.query) : [ad.query]).filter(Boolean);
  return (
    <a
      href={ad.link || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-xl bg-[#1C1C21] hover:bg-[#232329] transition-colors group"
    >
      <div className="flex items-center gap-1.5 text-[12px] text-[#B4B4BC] min-w-0">
        <span className="font-semibold text-[#D4D4D8] shrink-0">Sponsored</span>
        <span>·</span>
        <span className="truncate">{domain}</span>
        {ad.competitorName && (
          <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded bg-[#27272A] text-[12px] text-[#D4D4D8]">{ad.competitorName}</span>
        )}
      </div>
      <h4 className="text-[14px] font-medium text-[#93C5FD] leading-snug mt-1 group-hover:underline">{ad.title}</h4>
      {ad.snippet && <p className="text-[12px] text-[#B4B4BC] leading-relaxed mt-1 line-clamp-3">{ad.snippet}</p>}
      {queries.length > 0 && (
        <p className="text-[12px] text-[#8B8B94] mt-2 line-clamp-2">
          Seen on {queries.map((q) => `“${q}”`).join(", ")}
          {ad.collectedAt && ` · ${fmtDate(ad.collectedAt)}`}
        </p>
      )}
    </a>
  );
}

export function IntelligenceSidebar({ intel, companyName, sessionId, onAsk, isAsking = false, onUnlock }: IntelligenceSidebarProps) {
  const [tab, setTab] = useState<Tab>("questions");
  const listRef = useRef<HTMLDivElement>(null);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuickAnswer>>({});
  const [adsView, setAdsView] = useState<"search" | "library">("search");
  const [adGroup, setAdGroup] = useState<AdGroup>("competitor");
  const [filter, setFilter] = useState<"all" | CompetitorCategory>("all");
  const [openScore, setOpenScore] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const { questions, competitors, adLibrary, counts } = intel;
  const status = statusOf(intel);

  const countFor = (f: "all" | CompetitorCategory) =>
    f === "all"
      ? competitors.length
      : f === "marketplace"
        ? competitors.filter((c) => c.category === "marketplace" || c.category === "publisher").length
        : competitors.filter((c) => c.category === f).length;

  const filteredCompetitors = competitors.filter((c) =>
    filter === "all" ? true : filter === "marketplace" ? c.category === "marketplace" || c.category === "publisher" : c.category === filter
  );

  // ─── AI answers for questions Google didn't answer (fetched once, then saved with the analysis) ───
  const fetchAnswer = async (id: string, question: string) => {
    setAnswers((a) => ({ ...a, [id]: { state: "loading" } }));
    try {
      const res = await fetch("/api/intelligence/quick-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't get an answer right now.");
      setAnswers((a) => ({ ...a, [id]: { state: "done", answer: data.answer, tip: data.tip } }));
    } catch (e) {
      setAnswers((a) => ({ ...a, [id]: { state: "error", message: e instanceof Error ? e.message : "Couldn't get an answer right now." } }));
    }
  };

  const toggleQuestion = (q: SearchIntelView["questions"][number]) => {
    if (openQuestion === q.id) {
      setOpenQuestion(null);
      return;
    }
    setOpenQuestion(q.id);
    const existing = answers[q.id];
    if (!q.googleAnswer && !q.aiAnswer && (!existing || existing.state === "error")) fetchAnswer(q.id, q.question);
  };

  const tabs: { id: Tab; count: number; label: string }[] = [
    { id: "questions", count: counts.questions, label: "Questions" },
    { id: "ads", count: counts.ads, label: "Ads" },
    { id: "competitors", count: counts.competitors, label: "Competitors" },
  ];

  const adGroups: { id: AdGroup; label: string; ads: KeywordAdResult[] }[] = [
    { id: "competitor", label: "Competitors", ads: intel.ads.competitor },
    { id: "other", label: "Other advertisers", ads: intel.ads.other },
    { id: "own", label: "Your ads", ads: intel.ads.own },
  ];
  const searchCount = intel.searches.filter((s) => s.ok && s.purpose !== "ad_library" && s.purpose !== "market_evidence").length;

  return (
    <MotionConfig reducedMotion="user">
    <aside className="w-full lg:w-84 xl:w-96 shrink-0 flex flex-col rounded-[20px] bg-[#111114] overflow-hidden lg:sticky lg:top-20 max-h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#F4F4F5]">Search intel</h2>
          <span className="flex items-center gap-1.5 text-[12px] text-[#B4B4BC] min-w-0">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: status.dot }} />
            <span className="truncate">{status.label}</span>
          </span>
        </div>
        <p className="text-[13px] text-[#B4B4BC] mt-0.5 leading-snug">
          What {possessive(companyName)} buyers search, and who&apos;s competing for them
          {intel.market ? ` on Google ${intel.market.searchLocation.split(",")[0]}` : ""}.
        </p>

        {/* Tabs as stat tiles; each number is the length of the list behind it. The white tile slides to the one picked. */}
        <div className="grid grid-cols-3 gap-1.5 mt-3" role="tablist" aria-label="Search intel">
          {tabs.map((t) => {
            const active = !intel.locked && tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (intel.locked) return onUnlock?.();
                  setTab(t.id);
                  listRef.current?.scrollTo({ top: 0 });
                }}
                className={`relative rounded-xl px-2.5 py-2 text-left transition-colors duration-200 active:scale-[0.97] cursor-pointer ${
                  active ? "text-[#09090B]" : "bg-[#1C1C21] text-[#B4B4BC] hover:bg-[#232329] hover:text-[#F4F4F5]"
                }`}
              >
                {active && <motion.span layoutId="intel-tab" transition={SLIDE} className="absolute inset-0 rounded-xl bg-[#F4F4F5]" aria-hidden="true" />}
                <span className="relative block text-[17px] font-semibold leading-none tabular-nums">
                  <Counter value={t.count} fontSize="1em" fade={0} />
                </span>
                <span className="relative block text-[12px] mt-1 leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {intel.locked ? (
        <LockedIntel companyName={companyName} counts={counts} onUnlock={onUnlock} />
      ) : (
        <div ref={listRef} className="relative flex-1 overflow-y-auto px-4 pb-4 pt-1 custom-scrollbar">
          {/* popLayout: the old list steps out of the flow and fades while the new one arrives, so nothing waits on it */}
          <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={tab} {...SWAP} className="relative space-y-6">
          {/* ═══ QUESTIONS ═══ */}
          {tab === "questions" && (
            <>
              <section>
                <SectionLabel hint="From Google's “People also ask”">What buyers ask Google</SectionLabel>
                {questions.length === 0 ? (
                  <Empty>Google didn&apos;t show buyer questions for these searches.</Empty>
                ) : (
                  <div className="space-y-1.5">
                    {questions.map((q) => {
                      const open = openQuestion === q.id;
                      const fetched = answers[q.id];
                      const ai = q.aiAnswer ?? (fetched?.state === "done" ? { text: fetched.answer, tip: fetched.tip } : undefined);
                      return (
                        <div
                          key={q.id}
                          className={`rounded-xl border transition-colors ${
                            open ? "bg-[#232329] border-transparent" : "bg-[#1C1C21] border-transparent hover:bg-[#232329]"
                          }`}
                        >
                          <button
                            onClick={() => toggleQuestion(q)}
                            aria-expanded={open}
                            className="w-full px-3 py-2.5 flex items-start justify-between gap-2 text-left cursor-pointer"
                          >
                            <span className="text-[13px] font-medium text-[#F4F4F5] leading-snug">{q.question}</span>
                            <ChevronDown className={`w-4 h-4 text-[#8B8B94] shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
                          </button>

                          <AnimatePresence initial={false}>
                            {open && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-3 space-y-2.5">
                                  {q.googleAnswer && (
                                    <div>
                                      <p className="text-[12px] font-medium text-[#8B8B94] mb-1">From Google</p>
                                      <p className="text-[13px] text-[#D4D4D8] leading-relaxed whitespace-pre-line">{q.googleAnswer.text}</p>
                                    </div>
                                  )}

                                  {!q.googleAnswer && !ai && (!fetched || fetched.state === "loading") && (
                                    <p className="flex items-start gap-2 py-1 text-[13px] text-[#B4B4BC] leading-relaxed" role="status">
                                      <span className="mt-[3px] w-3.5 h-3.5 border-2 border-[#B4B4BC] border-t-transparent rounded-full animate-spin shrink-0" aria-hidden="true" />
                                      Google showed no answer, so Loopy is writing one. This can take up to 20 seconds.
                                    </p>
                                  )}

                                  {fetched?.state === "error" && !ai && (
                                    <div className="flex items-center justify-between gap-2 text-[12px] text-[#B4B4BC]">
                                      <span>{fetched.message}</span>
                                      <button
                                        onClick={() => fetchAnswer(q.id, q.question)}
                                        className="inline-flex items-center gap-1 text-[#F4F4F5] hover:underline cursor-pointer shrink-0"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        Retry
                                      </button>
                                    </div>
                                  )}

                                  {ai && (
                                    <div>
                                      <p className="text-[12px] font-medium text-[#8B8B94] mb-1">Loopy&apos;s answer (AI, not from Google)</p>
                                      {!q.googleAnswer && <p className="text-[13px] text-[#D4D4D8] leading-relaxed whitespace-pre-line">{ai.text}</p>}
                                      {ai.tip && (
                                        <p className="mt-1.5 text-[12px] text-[#F4F4F5] leading-relaxed pl-2.5 border-l-2 border-[#3F3F48]">
                                          <span className="text-[#F4F4F5] font-semibold">Use it: </span>
                                          {ai.tip}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 text-[12px]">
                                    {onAsk && (
                                      <button
                                        onClick={() =>
                                          onAsk(
                                            `Buyers ask Google: "${q.question}". How should ${companyName} answer this in our content and on our website? Give me a ready-to-post answer and a short video idea.`
                                          )
                                        }
                                        disabled={isAsking}
                                        className="inline-flex items-center gap-1.5 text-[#F4F4F5] font-medium hover:underline disabled:opacity-40 cursor-pointer"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        Turn into content
                                      </button>
                                    )}
                                    <a
                                      href={q.googleAnswer?.sourceUrl || googleSearch(q.question)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[#B4B4BC] hover:text-[#F4F4F5]"
                                    >
                                      {q.googleAnswer?.sourceUrl ? q.googleAnswer.sourceTitle || domainOf(q.googleAnswer.sourceUrl) : "See on Google"}
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                  {q.sourceQuery && <p className="text-[12px] text-[#8B8B94]">Google showed this for “{q.sourceQuery}”</p>}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {intel.searches.length > 0 && (
                <section>
                  <SectionLabel hint={intel.cachedSearches ? `${intel.cachedSearches} reused from earlier` : undefined}>What we searched</SectionLabel>
                  <div className="space-y-1">
                    {intel.searches.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.purpose === "ad_library" ? `https://adstransparency.google.com/?domain=${encodeURIComponent(s.query)}` : googleSearch(s.query)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#1C1C21] hover:bg-[#232329] transition-colors group"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Search className="w-3.5 h-3.5 text-[#8B8B94] shrink-0" />
                          <span className="text-[13px] text-[#D4D4D8] truncate group-hover:text-[#F4F4F5]">{s.query}</span>
                        </span>
                        <span className={`text-[12px] shrink-0 ${s.ok ? "text-[#8B8B94]" : "text-[#F87171]"}`}>
                          {s.ok ? PURPOSE_LABEL[s.purpose] || s.purpose : "Failed"}
                        </span>
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {intel.organic.length > 0 && (
                <section>
                  <SectionLabel hint="Unpaid results">Who ranks on Google</SectionLabel>
                  <ol className="space-y-1">
                    {intel.organic.map((o, idx) => (
                      <li key={idx}>
                        <a href={o.link} target="_blank" rel="noopener noreferrer" className="flex gap-2.5 px-3 py-2 rounded-lg hover:bg-[#1C1C21] transition-colors group">
                          <span className="text-[12px] font-semibold text-[#8B8B94] tabular-nums w-4 shrink-0 pt-px">{o.position}</span>
                          <span className="min-w-0">
                            <span className="block text-[13px] text-[#F4F4F5] leading-snug line-clamp-2 group-hover:underline">{o.title}</span>
                            <span className="block text-[12px] text-[#8B8B94] truncate mt-0.5">{o.domain}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {intel.shopping.length > 0 && (
                <section>
                  <SectionLabel hint="Google Shopping">Products shown to buyers</SectionLabel>
                  <div className="space-y-1">
                    {intel.shopping.map((p, idx) => (
                      <a
                        key={idx}
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1C1C21] hover:bg-[#232329] transition-colors"
                      >
                        {p.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.thumbnail} alt="" className="w-9 h-9 rounded-md object-cover bg-[#27272A] shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12px] text-[#F4F4F5] truncate">{p.title}</span>
                          {p.source && <span className="block text-[12px] text-[#8B8B94] truncate">{p.source}</span>}
                        </span>
                        {p.price && <span className="text-[13px] font-semibold text-[#F4F4F5] shrink-0">{p.price}</span>}
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ═══ ADS ═══ */}
          {tab === "ads" && (
            <>
              <RubberSegment
                items={[
                  { value: "search", label: `On Google search (${intel.ads.competitor.length})` },
                  { value: "library", label: `Ad Library (${adLibrary.length})` },
                ]}
                value={adsView}
                onChange={(v) => setAdsView(v as "search" | "library")}
                aria-label="Which ads"
                size="sm"
                radius={999}
                trackColor="#09090B"
                thumbColor="#2A2A30"
                textColor="#B4B4BC"
                activeTextColor="#F4F4F5"
                className="w-full"
              />

              <AnimatePresence mode="popLayout" initial={false}>
              {adsView === "search" ? (
                <motion.section key="search" {...SWAP} className="space-y-3">
                  <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
                    {adGroups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setAdGroup(g.id)}
                        className={`relative h-8 px-3.5 rounded-full text-[13px] font-medium shrink-0 transition-colors duration-200 active:scale-[0.97] cursor-pointer ${
                          adGroup === g.id ? "text-[#09090B]" : "bg-[#1C1C21] text-[#B4B4BC] hover:bg-[#232329] hover:text-[#F4F4F5]"
                        }`}
                      >
                        {adGroup === g.id && (
                          <motion.span layoutId="intel-ad-group" transition={SLIDE} className="absolute inset-0 rounded-full bg-[#F4F4F5]" aria-hidden="true" />
                        )}
                        <span className="relative">
                          {g.label} <span className="tabular-nums opacity-60">{g.ads.length}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                  {adGroups
                    .filter((g) => g.id === adGroup)
                    .map((g) => (
                      <motion.div key={g.id} {...SWAP}>
                      {g.ads.length === 0 ? (
                        <Empty>
                          {g.id === "competitor"
                            ? `No competitor ads showed up on these ${plural(searchCount, "search")}. Ads change by time and place, so they may still advertise.`
                            : g.id === "own"
                              ? `None of ${possessive(companyName)} own ads showed up on these searches.`
                              : "No other advertisers showed up."}
                        </Empty>
                      ) : (
                        <div className="space-y-2">
                          {g.id === "other" && (
                            <p className="text-[12px] text-[#8B8B94] leading-relaxed">
                              Advertisers on your buyers&apos; searches that we couldn&apos;t confirm as competitors.
                            </p>
                          )}
                          {g.ads.map((ad) => (
                            <SearchAdCard key={ad.id} ad={ad} />
                          ))}
                        </div>
                      )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  <p className="text-[12px] text-[#8B8B94] leading-relaxed">
                    Sponsored results we saw while searching. Seeing an ad shows it ran for that search, not its budget or results.
                  </p>
                </motion.section>
              ) : (
                <motion.section key="library" {...SWAP}>
                  <SectionLabel hint="Google Ads Transparency Center">Competitors&apos; ads on record</SectionLabel>
                  <p className="text-[12px] text-[#8B8B94] leading-relaxed -mt-1 mb-2.5">
                    Recent ads Google has on record for each competitor, for any product, not only this category.
                  </p>
                  {adLibrary.length === 0 ? (
                    <Empty>
                      {competitors.some((c) => c.transparencyStatus && c.transparencyStatus !== "not_verified")
                        ? "Google's Ad Library had no ads on record for the competitors we checked."
                        : "The Ad Library wasn't checked for this analysis."}
                    </Empty>
                  ) : (
                    <div className="space-y-2.5">
                      {adLibrary.map((entry) => (
                        <div key={entry.id} className="rounded-xl bg-[#1C1C21] p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#F4F4F5] truncate">{entry.competitorName}</p>
                              {entry.advertiser && entry.advertiserMatchesCompetitor === false && (
                                <p className="text-[12px] text-[#8B8B94] truncate">Run by {entry.advertiser}</p>
                              )}
                            </div>
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-[#27272A] text-[12px] text-[#D4D4D8] capitalize">{entry.format} ad</span>
                          </div>

                          {entry.previewImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.previewImageUrl}
                              alt={`${entry.competitorName} ${entry.format} ad preview`}
                              loading="lazy"
                              className="w-full max-h-48 rounded-lg border border-[#27272A] object-contain bg-white"
                            />
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-3 rounded-lg border border-dashed border-[#27272A] text-[12px] text-[#8B8B94]">
                              <ImageOff className="w-4 h-4 shrink-0" />
                              Google didn&apos;t provide a preview for this {entry.format} ad.
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-[#B4B4BC]">
                            <span>
                              {entry.firstShownAt && entry.lastShownAt
                                ? `Shown ${fmtDate(entry.firstShownAt)} – ${fmtDate(entry.lastShownAt)}`
                                : entry.lastShownAt
                                  ? `Last shown ${fmtDate(entry.lastShownAt)}`
                                  : "Dates not provided"}
                              {typeof entry.totalDaysShown === "number" && ` · ${plural(entry.totalDaysShown, "day")}`}
                            </span>
                            {entry.detailsUrl && (
                              <a
                                href={entry.detailsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[#D4D4D8] hover:text-[#F4F4F5]"
                              >
                                View on Google
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.section>
              )}
              </AnimatePresence>
            </>
          )}

          {/* ═══ COMPETITORS ═══ */}
          {tab === "competitors" && (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
                {(
                  [
                    ["all", "All"],
                    ["direct", "Direct"],
                    ["indirect", "Indirect"],
                    ["marketplace", "Marketplaces"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setFilter(id)}
                    className={`relative h-8 px-3.5 rounded-full text-[13px] font-medium shrink-0 transition-colors duration-200 active:scale-[0.97] cursor-pointer ${
                      filter === id ? "text-[#09090B]" : "bg-[#1C1C21] text-[#B4B4BC] hover:bg-[#232329] hover:text-[#F4F4F5]"
                    }`}
                  >
                    {filter === id && (
                      <motion.span layoutId="intel-filter" transition={SLIDE} className="absolute inset-0 rounded-full bg-[#F4F4F5]" aria-hidden="true" />
                    )}
                    <span className="relative">
                      {label} <span className="tabular-nums opacity-60">{countFor(id)}</span>
                    </span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait" initial={false}>
              <motion.div key={filter} {...SWAP}>
              {filteredCompetitors.length === 0 ? (
                <Empty>{competitors.length === 0 ? "No competitors were confirmed by the search results." : "No competitors in this group."}</Empty>
              ) : (
                <div className="space-y-2">
                  {filteredCompetitors.map((comp) => {
                    const key = comp.domain || comp.name;
                    const detailsOpen = openScore === key;
                    const runsAds = (comp.sponsoredRankings && comp.sponsoredRankings.length > 0) || comp.transparencyStatus === "verified_has_ads";
                    const site = comp.website || comp.domain;
                    const factors = comp.scoreFactors;
                    const legacy = comp.scoreBreakdown;
                    return (
                      <div key={key} className="rounded-xl bg-[#1C1C21] p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-[14px] font-semibold text-[#F4F4F5] truncate">{comp.name}</h4>
                            <div className="flex items-center gap-1.5 text-[12px] text-[#8B8B94] mt-0.5 flex-wrap">
                              <span>{CATEGORY_LABEL[comp.category || ""] || "Competitor"}</span>
                              {site && (
                                <>
                                  <span>·</span>
                                  <a
                                    href={site.startsWith("http") ? site : `https://${site}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-[#F4F4F5] inline-flex items-center gap-0.5"
                                  >
                                    {domainOf(site)}
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </>
                              )}
                              {runsAds && (
                                <>
                                  <span>·</span>
                                  <span className="text-[#D4D4D8]">Runs Google ads</span>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => setOpenScore(detailsOpen ? null : key)}
                            aria-expanded={detailsOpen}
                            title="How this was worked out"
                            className="shrink-0 text-right cursor-pointer group"
                          >
                            {typeof comp.score === "number" ? (
                              <span className="block text-[15px] font-semibold text-[#F4F4F5] tabular-nums leading-none">
                                {comp.score}
                                <span className="text-[12px] text-[#8B8B94] font-normal">/100</span>
                              </span>
                            ) : (
                              <span className="block text-[12px] text-[#8B8B94] leading-none">Not scored</span>
                            )}
                            <span className="block text-[12px] text-[#8B8B94] mt-1 group-hover:text-[#B4B4BC]">
                              {typeof comp.score === "number" ? "match · why?" : "why?"}
                            </span>
                          </button>
                        </div>

                        {typeof comp.score === "number" && (
                          <div className="h-1 rounded-full bg-[#27272A] overflow-hidden" aria-hidden="true">
                            <div className="h-full rounded-full bg-[#8B5CF6]" style={{ width: `${Math.min(100, comp.score)}%` }} />
                          </div>
                        )}

                        <AnimatePresence initial={false}>
                        {detailsOpen && (
                          <motion.div
                            key="details"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                          <div className="space-y-2 pt-1 text-[12px] text-[#B4B4BC]">
                            {factors?.map((f) => (
                              <div key={f.key} className="flex justify-between gap-3">
                                <span>
                                  {f.label} <span className="text-[#8B8B94]">· {f.basis}</span>
                                </span>
                                <span className="text-[#F4F4F5] tabular-nums shrink-0">
                                  {f.points}/{f.max}
                                </span>
                              </div>
                            ))}
                            {!factors && legacy && (
                              <p className="text-[#8B8B94]">Older analysis: this score used fixed estimates. Run a new analysis for an evidence-based score.</p>
                            )}
                            {typeof comp.score !== "number" && <p className="text-[#8B8B94]">Not enough evidence for a match score.</p>}
                            {comp.evidence && comp.evidence.length > 0 && (
                              <div>
                                <p className="text-[#8B8B94] mb-1">Confirmed by:</p>
                                <ul className="space-y-1">
                                  {comp.evidence.map((e, i) => (
                                    <li key={i} className="truncate">
                                      {e.url ? (
                                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#F4F4F5] hover:underline">
                                          {e.title}
                                        </a>
                                      ) : (
                                        e.title
                                      )}
                                      {e.query && <span className="text-[#8B8B94]"> · “{e.query}”</span>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          </motion.div>
                        )}
                        </AnimatePresence>

                        {comp.description && <p className="text-[12px] text-[#B4B4BC] leading-relaxed line-clamp-3">{plainText(comp.description)}</p>}

                        {realPrice(comp.pricing) && (
                          <p className="text-[12px] text-[#B4B4BC]">
                            <span className="text-[#8B8B94]">Price seen in results: </span>
                            <span className="text-[#F4F4F5]">{realPrice(comp.pricing)}</span>
                          </p>
                        )}

                        {onAsk && (
                          <button
                            onClick={() =>
                              onAsk(`How can ${companyName} win customers from ${comp.name}${comp.domain ? ` (${comp.domain})` : ""}? Give me 3 specific moves for this week.`)
                            }
                            disabled={isAsking}
                            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#F4F4F5] hover:underline disabled:opacity-40 cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            How do I beat them?
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </motion.div>
              </AnimatePresence>

              <p className="text-[12px] text-[#8B8B94] leading-relaxed">
                Only companies the search results confirm are listed. The match score adds product similarity (Gemini&apos;s read of the
                results), how many of the same searches they appear on, and whether they advertise there. It isn&apos;t a probability
                and doesn&apos;t measure size, revenue, price or location.
              </p>
            </>
          )}
          </motion.div>
          </AnimatePresence>
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-[#1F1F24] text-[12px] text-[#8B8B94]">
        <div className="flex items-center justify-between gap-2">
          <span>Google results via SerpApi, web research via Tavily</span>
          {!intel.locked && intel.limitations.length > 0 && (
            <button onClick={() => setShowNotes((s) => !s)} className="shrink-0 text-[#B4B4BC] hover:text-[#F4F4F5] cursor-pointer">
              {showNotes ? "Hide notes" : `Notes (${intel.limitations.length})`}
            </button>
          )}
        </div>
        {showNotes && !intel.locked && (
          <ul className="mt-2 space-y-1 text-[12px] text-[#B4B4BC] leading-relaxed list-disc pl-4">
            {intel.limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        )}
      </div>
    </aside>
    </MotionConfig>
  );
}
