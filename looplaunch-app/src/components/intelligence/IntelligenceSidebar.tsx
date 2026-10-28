"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ExternalLink,
  ChevronDown,
  Search,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import type {
  MarketIntelligence,
  CompetitorIntelligence,
  CompetitorCategory,
  KeywordAdResult,
} from "@/lib/intelligence/types";

interface IntelligenceSidebarProps {
  marketIntelligence?: MarketIntelligence;
  competitorIntelligence?: CompetitorIntelligence[];
  companyName: string;
  sessionId: string;
  /** Send a question to Loopy in the main chat. */
  onAsk?: (question: string) => void;
  isAsking?: boolean;
}

type Tab = "questions" | "ads" | "competitors";

type QuickAnswer =
  | { state: "loading" }
  | { state: "done"; answer: string; tip?: string; source?: { title: string; link: string } }
  | { state: "error"; message: string };

const QUESTIONS_PREVIEW = 8;

/** Plain-language labels for search intent. */
const INTENT_LABEL: Record<string, string> = {
  commercial: "Comparing options",
  transactional: "Ready to buy",
  informational: "Researching",
  navigational: "Looking for a brand",
};

const CATEGORY_LABEL: Record<string, string> = {
  direct: "Direct rival",
  indirect: "Indirect",
  marketplace: "Marketplace",
  publisher: "Publisher",
};

/** Host of a URL or of a Google "displayed link" such as "https://www.bestbuy.com › phones". */
function domainOf(url?: string): string {
  if (!url) return "";
  const host = url.trim().replace(/^https?:\/\//i, "").split(/[\s›/?#]/)[0] || "";
  return host.toLowerCase().replace(/^www\./, "");
}

/** Ad links are often Google tracking URLs; the displayed link names the real advertiser. */
function adDomain(ad: { link?: string; displayedLink?: string }): string {
  const fromLink = domainOf(ad.link);
  if (fromLink && !/google|doubleclick/.test(fromLink)) return fromLink;
  return domainOf(ad.displayedLink) || fromLink;
}

/** Search snippets can carry markdown or page furniture; keep plain sentences. */
function plainText(text?: string): string {
  return (text || "")
    .replace(/[#*_`>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Only show a price when it actually looks like one ("From $799", "₹1,299", "$12/month"). */
function realPrice(p?: string): string | null {
  if (!p) return null;
  const clean = plainText(p);
  return clean.length <= 40 && /[$₹£€]\s?\d|\d\s?(usd|inr|rs)\b/i.test(clean) ? clean : null;
}

const googleSearch = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

function SectionLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mb-2">
      <h3 className="text-[13px] font-semibold text-[#F4F4F5]">{children}</h3>
      {hint && <span className="text-[11px] text-[#71717A] shrink-0">{hint}</span>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-4 rounded-xl bg-[#141418] border border-[#222227] text-center text-[12px] text-[#71717A] leading-relaxed">
      {children}
    </p>
  );
}

export function IntelligenceSidebar({
  marketIntelligence,
  competitorIntelligence,
  companyName,
  sessionId,
  onAsk,
  isAsking = false,
}: IntelligenceSidebarProps) {
  const [tab, setTab] = useState<Tab>("questions");
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, QuickAnswer>>({});
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [adsView, setAdsView] = useState<"search" | "library">("search");
  const [filter, setFilter] = useState<"all" | CompetitorCategory>("all");
  const [openScore, setOpenScore] = useState<string | null>(null);

  // ─── Data ───
  const questions = useMemo(
    () => (marketIntelligence?.peopleAlsoAsk || []).filter((q) => q.question),
    [marketIntelligence]
  );
  const organic = marketIntelligence?.organicKeywords || [];
  const queries = marketIntelligence?.generatedQueries || [];
  const shopping = marketIntelligence?.shoppingResults || [];
  const competitors = useMemo(() => competitorIntelligence || [], [competitorIntelligence]);

  const keywordAds: KeywordAdResult[] = useMemo(
    () =>
      marketIntelligence?.keywordAds ||
      (marketIntelligence?.googleAds || []).map((a, idx) => ({
        id: `ad_${idx}`,
        position: idx + 1,
        blockPosition: "top" as const,
        title: a.title,
        link: a.link,
        displayedLink: a.displayedLink || "",
        snippet: a.snippet || "",
        query: "",
        location: "",
        collectedAt: "",
      })),
    [marketIntelligence]
  );

  // Who is paying for ads, by domain, most ads first.
  const advertisers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ad of keywordAds) {
      const d = adDomain(ad);
      if (d) counts.set(d, (counts.get(d) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [keywordAds]);

  const withCreatives = competitors.filter((c) => c.creatives && c.creatives.length > 0);
  const totalCreatives = withCreatives.reduce((n, c) => n + (c.creatives?.length || 0), 0);

  const countFor = (f: "all" | CompetitorCategory) =>
    f === "all"
      ? competitors.length
      : f === "marketplace"
        ? competitors.filter((c) => c.category === "marketplace" || c.category === "publisher").length
        : competitors.filter((c) => c.category === f).length;

  const filteredCompetitors = competitors
    .filter((c) =>
      filter === "all"
        ? true
        : filter === "marketplace"
          ? c.category === "marketplace" || c.category === "publisher"
          : c.category === filter
    )
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // ─── Quick answers ───
  const fetchAnswer = async (idx: number) => {
    const q = questions[idx];
    if (!q) return;
    const ready = q.snippet || q.answer;
    if (ready) {
      setAnswers((a) => ({
        ...a,
        [idx]: {
          state: "done",
          answer: ready,
          tip: q.tip,
          source: q.snippet && q.link ? { title: q.title || domainOf(q.link), link: q.link } : undefined,
        },
      }));
      return;
    }
    setAnswers((a) => ({ ...a, [idx]: { state: "loading" } }));
    try {
      const res = await fetch("/api/intelligence/quick-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question: q.question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't get an answer right now.");
      setAnswers((a) => ({ ...a, [idx]: { state: "done", answer: data.answer, tip: data.tip } }));
    } catch (e) {
      setAnswers((a) => ({
        ...a,
        [idx]: { state: "error", message: e instanceof Error ? e.message : "Couldn't get an answer right now." },
      }));
    }
  };

  const toggleQuestion = (idx: number) => {
    if (openQuestion === idx) {
      setOpenQuestion(null);
      return;
    }
    setOpenQuestion(idx);
    const existing = answers[idx];
    if (!existing || existing.state === "error") fetchAnswer(idx);
  };

  const tabs: { id: Tab; count: number; label: string }[] = [
    { id: "questions", count: questions.length, label: "Questions" },
    { id: "ads", count: keywordAds.length + totalCreatives, label: "Ads" },
    { id: "competitors", count: competitors.length, label: "Competitors" },
  ];

  const visibleQuestions = showAllQuestions ? questions : questions.slice(0, QUESTIONS_PREVIEW);

  return (
    <aside className="w-full lg:w-84 xl:w-96 shrink-0 flex flex-col rounded-2xl bg-[#111114] border border-[#27272A] overflow-hidden lg:sticky lg:top-20 max-h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#F4F4F5]">Search intel</h2>
          <span className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            Live from Google
          </span>
        </div>
        <p className="text-[12px] text-[#A1A1AA] mt-0.5 leading-snug">
          What {companyName}&apos;s buyers search, and who&apos;s competing for them.
        </p>

        {/* Tabs as stat tiles */}
        <div className="grid grid-cols-3 gap-1.5 mt-3" role="tablist" aria-label="Search intel">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-2.5 py-2 text-left border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#F4F4F5] border-[#F4F4F5] text-[#09090B]"
                    : "bg-[#141418] border-[#27272A] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-[#F4F4F5]"
                }`}
              >
                <span className="block text-[17px] font-semibold leading-none tabular-nums">{t.count}</span>
                <span className="block text-[11px] mt-1 leading-none">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 pt-1 space-y-6 custom-scrollbar">
        {/* ═══ QUESTIONS ═══ */}
        {tab === "questions" && (
          <>
            <section>
              <SectionLabel hint="Tap one for the answer">What buyers ask Google</SectionLabel>
              {questions.length === 0 ? (
                <Empty>No buyer questions came back from Google for this market.</Empty>
              ) : (
                <div className="space-y-1.5">
                  {visibleQuestions.map((q, idx) => {
                    const open = openQuestion === idx;
                    const a = answers[idx];
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border transition-colors ${
                          open ? "bg-[#17171B] border-[#3F3F46]" : "bg-[#141418] border-[#222227] hover:border-[#3F3F46]"
                        }`}
                      >
                        <button
                          onClick={() => toggleQuestion(idx)}
                          aria-expanded={open}
                          className="w-full px-3 py-2.5 flex items-start justify-between gap-2 text-left cursor-pointer"
                        >
                          <span className="text-[13px] font-medium text-[#F4F4F5] leading-snug">{q.question}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-[#71717A] shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`}
                          />
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
                                {(!a || a.state === "loading") && (
                                  <div className="space-y-1.5 py-1" role="status">
                                    <p className="text-[12px] text-[#A1A1AA] mb-2">Loopy is looking this up. This can take up to 20 seconds.</p>
                                    <div className="h-2.5 rounded bg-[#27272A] animate-pulse w-full" />
                                    <div className="h-2.5 rounded bg-[#27272A] animate-pulse w-11/12" />
                                    <div className="h-2.5 rounded bg-[#27272A] animate-pulse w-2/3" />
                                  </div>
                                )}

                                {a?.state === "error" && (
                                  <div className="flex items-center justify-between gap-2 text-[12px] text-[#A1A1AA]">
                                    <span>{a.message}</span>
                                    <button
                                      onClick={() => fetchAnswer(idx)}
                                      className="inline-flex items-center gap-1 text-[#F4F4F5] hover:underline cursor-pointer shrink-0"
                                    >
                                      <RotateCcw className="w-3 h-3" />
                                      Retry
                                    </button>
                                  </div>
                                )}

                                {a?.state === "done" && (
                                  <>
                                    <p className="text-[12.5px] text-[#D4D4D8] leading-relaxed whitespace-pre-line">{a.answer}</p>
                                    {a.tip && (
                                      <p className="text-[12px] text-[#F4F4F5] leading-relaxed pl-2.5 border-l-2 border-[#F472B6]">
                                        <span className="text-[#F472B6] font-medium">Use it: </span>
                                        {a.tip}
                                      </p>
                                    )}
                                  </>
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
                                    href={a?.state === "done" && a.source ? a.source.link : googleSearch(q.question)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[#A1A1AA] hover:text-[#F4F4F5]"
                                  >
                                    {a?.state === "done" && a.source ? a.source.title || "Source" : "See on Google"}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}

                  {questions.length > QUESTIONS_PREVIEW && (
                    <button
                      onClick={() => setShowAllQuestions((s) => !s)}
                      className="w-full py-2 text-[12px] text-[#A1A1AA] hover:text-[#F4F4F5] cursor-pointer"
                    >
                      {showAllQuestions ? "Show fewer" : `Show all ${questions.length} questions`}
                    </button>
                  )}
                </div>
              )}
            </section>

            {queries.length > 0 && (
              <section>
                <SectionLabel>What they type into Google</SectionLabel>
                <div className="space-y-1">
                  {queries.slice(0, 8).map((q, idx) => (
                    <a
                      key={idx}
                      href={googleSearch(q.query)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#141418] border border-[#222227] hover:border-[#3F3F46] transition-colors group"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Search className="w-3.5 h-3.5 text-[#52525B] shrink-0" />
                        <span className="text-[12.5px] text-[#D4D4D8] truncate group-hover:text-[#F4F4F5]">{q.query}</span>
                      </span>
                      <span className="text-[11px] text-[#71717A] shrink-0">{INTENT_LABEL[q.intent] || q.intent}</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {organic.length > 0 && (
              <section>
                <SectionLabel hint="Unpaid results">Who ranks on Google</SectionLabel>
                <ol className="space-y-1">
                  {organic.slice(0, 6).map((o, idx) => (
                    <li key={idx}>
                      <a
                        href={o.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-2.5 px-3 py-2 rounded-lg hover:bg-[#141418] transition-colors group"
                      >
                        <span className="text-[12px] font-semibold text-[#52525B] tabular-nums w-4 shrink-0 pt-px">{o.position}</span>
                        <span className="min-w-0">
                          <span className="block text-[12.5px] text-[#F4F4F5] leading-snug line-clamp-2 group-hover:underline">{o.title}</span>
                          <span className="block text-[11px] text-[#71717A] truncate mt-0.5">{domainOf(o.link)}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {shopping.length > 0 && (
              <section>
                <SectionLabel hint="Google Shopping">Products shown to buyers</SectionLabel>
                <div className="space-y-1">
                  {shopping.slice(0, 4).map((p, idx) => (
                    <a
                      key={idx}
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#141418] border border-[#222227] hover:border-[#3F3F46] transition-colors"
                    >
                      {p.thumbnail && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail} alt="" className="w-9 h-9 rounded-md object-cover bg-[#27272A] shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] text-[#F4F4F5] truncate">{p.title}</span>
                        {p.source && <span className="block text-[11px] text-[#71717A] truncate">{p.source}</span>}
                      </span>
                      {p.price && <span className="text-[12.5px] font-semibold text-[#F4F4F5] shrink-0">{p.price}</span>}
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
            <div className="flex p-0.5 rounded-lg bg-[#141418] border border-[#222227] text-[12px]">
              {(
                [
                  ["search", `On Google search (${keywordAds.length})`],
                  ["library", `Ad library (${totalCreatives})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setAdsView(id)}
                  className={`flex-1 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                    adsView === id ? "bg-[#27272A] text-[#F4F4F5]" : "text-[#71717A] hover:text-[#A1A1AA]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {adsView === "search" && (
              <>
                {advertisers.length > 0 && (
                  <section>
                    <SectionLabel>Who&apos;s paying for clicks</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {advertisers.slice(0, 8).map(([d, n]) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#141418] border border-[#27272A] text-[12px] text-[#D4D4D8]"
                        >
                          {d}
                          <span className="text-[#71717A] tabular-nums">{n}</span>
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <SectionLabel hint="As buyers see them">Their ads</SectionLabel>
                  {keywordAds.length === 0 ? (
                    <Empty>
                      Nobody is running Google search ads for these searches yet. That&apos;s a cheap opening if you want one.
                    </Empty>
                  ) : (
                    <div className="space-y-2">
                      {keywordAds.map((ad, idx) => (
                        <a
                          key={ad.id || idx}
                          href={ad.link || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-xl bg-[#141418] border border-[#222227] hover:border-[#3F3F46] transition-colors group"
                        >
                          <div className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA]">
                            <span className="font-semibold text-[#D4D4D8]">Sponsored</span>
                            <span>·</span>
                            <span className="truncate">{adDomain(ad)}</span>
                          </div>
                          <h4 className="text-[13.5px] font-medium text-[#93C5FD] leading-snug mt-1 group-hover:underline">
                            {ad.title}
                          </h4>
                          {ad.snippet && (
                            <p className="text-[12px] text-[#A1A1AA] leading-relaxed mt-1 line-clamp-3">{ad.snippet}</p>
                          )}
                          {ad.query && (
                            <p className="text-[11px] text-[#71717A] mt-2 truncate">Shown for “{ad.query}”</p>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {adsView === "library" && (
              <section>
                <SectionLabel hint="Google Ads Transparency Center">Ads competitors are running</SectionLabel>
                {withCreatives.length === 0 ? (
                  <Empty>None of your {competitors.length} competitors have ads in Google&apos;s ad library right now.</Empty>
                ) : (
                  <div className="space-y-3">
                    {withCreatives.map((comp) => (
                      <div key={comp.domain || comp.name} className="rounded-xl bg-[#141418] border border-[#222227] p-3 space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[13px] font-semibold text-[#F4F4F5] truncate">{comp.name}</span>
                          <span className="text-[11px] text-[#71717A] shrink-0">
                            {comp.creatives!.length} ad{comp.creatives!.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        {comp.creatives!.slice(0, 3).map((cr, i) => (
                          <div key={cr.id || i} className="rounded-lg bg-[#111114] border border-[#222227] p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-[#71717A]">
                              <span className="capitalize">{cr.format}</span>
                              {cr.lastShown && <span>Last seen {cr.lastShown}</span>}
                            </div>
                            {cr.body && <p className="text-[12px] text-[#D4D4D8] leading-relaxed">{cr.body}</p>}
                            {cr.image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={cr.image} alt={`${comp.name} ad`} className="max-h-28 rounded border border-[#27272A] object-contain bg-black/40" />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    {competitors.length > withCreatives.length && (
                      <p className="text-[12px] text-[#71717A] text-center">
                        {competitors.length - withCreatives.length} other competitors aren&apos;t running Google ads.
                      </p>
                    )}
                  </div>
                )}
              </section>
            )}
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
                  className={`px-3 py-1 rounded-full text-[12px] font-medium shrink-0 border transition-colors cursor-pointer ${
                    filter === id
                      ? "bg-[#F4F4F5] border-[#F4F4F5] text-[#09090B]"
                      : "bg-[#141418] border-[#27272A] text-[#A1A1AA] hover:text-[#F4F4F5]"
                  }`}
                >
                  {label} <span className="tabular-nums opacity-60">{countFor(id)}</span>
                </button>
              ))}
            </div>

            {filteredCompetitors.length === 0 ? (
              <Empty>No competitors in this group.</Empty>
            ) : (
              <div className="space-y-2">
                {filteredCompetitors.map((comp) => {
                  const key = comp.domain || comp.name;
                  const scoreOpen = openScore === key;
                  const runsAds =
                    (comp.creatives && comp.creatives.length > 0) || (comp.sponsoredRankings && comp.sponsoredRankings.length > 0);
                  const site = comp.website || comp.domain;
                  return (
                    <div key={key} className="rounded-xl bg-[#141418] border border-[#222227] p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-[13.5px] font-semibold text-[#F4F4F5] truncate">{comp.name}</h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#71717A] mt-0.5 flex-wrap">
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
                        {typeof comp.score === "number" && (
                          <button
                            onClick={() => setOpenScore(scoreOpen ? null : key)}
                            aria-expanded={scoreOpen}
                            title="How close this competitor is to you"
                            className="shrink-0 text-right cursor-pointer group"
                          >
                            <span className="block text-[15px] font-semibold text-[#F4F4F5] tabular-nums leading-none">
                              {comp.score}
                              <span className="text-[11px] text-[#71717A] font-normal">/100</span>
                            </span>
                            <span className="block text-[10.5px] text-[#71717A] mt-1 group-hover:text-[#A1A1AA]">match</span>
                          </button>
                        )}
                      </div>

                      {typeof comp.score === "number" && (
                        <div className="h-1 rounded-full bg-[#27272A] overflow-hidden" aria-hidden="true">
                          <div className="h-full rounded-full bg-[#F472B6]" style={{ width: `${Math.min(100, comp.score)}%` }} />
                        </div>
                      )}

                      {scoreOpen && comp.scoreBreakdown && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-[#A1A1AA] pt-1">
                          {(
                            [
                              ["Similar product", comp.scoreBreakdown.productSimilarity, 30],
                              ["Same audience", comp.scoreBreakdown.audienceOverlap, 20],
                              ["Business model", comp.scoreBreakdown.businessModel, 15],
                              ["Same searches", comp.scoreBreakdown.searchIntent, 15],
                              ["Same region", comp.scoreBreakdown.geography, 10],
                              ["Price level", comp.scoreBreakdown.pricingPosition, 10],
                            ] as const
                          ).map(([label, v, max]) => (
                            <div key={label} className="flex justify-between">
                              <span>{label}</span>
                              <span className="text-[#F4F4F5] tabular-nums">
                                {v}/{max}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {comp.description && (
                        <p className="text-[12px] text-[#A1A1AA] leading-relaxed line-clamp-3">{plainText(comp.description)}</p>
                      )}

                      {realPrice(comp.pricing) && (
                        <p className="text-[12px] text-[#A1A1AA]">
                          <span className="text-[#71717A]">Price seen: </span>
                          <span className="text-[#F4F4F5]">{realPrice(comp.pricing)}</span>
                        </p>
                      )}

                      {onAsk && (
                        <button
                          onClick={() =>
                            onAsk(
                              `How can ${companyName} win customers from ${comp.name}${comp.domain ? ` (${comp.domain})` : ""}? Give me 3 specific moves for this week.`
                            )
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

            <p className="text-[11px] text-[#52525B] leading-relaxed">
              Match score compares product, audience, pricing and the searches you both show up for. It doesn&apos;t measure size or revenue.
            </p>
          </>
        )}
      </div>

      <div className="px-4 py-2.5 border-t border-[#222227] text-[11px] text-[#52525B]">
        Data from Google search via SerpApi and Tavily
        {marketIntelligence?.collectedAt && (
          <> · {new Date(marketIntelligence.collectedAt).toLocaleDateString([], { month: "short", day: "numeric" })}</>
        )}
      </div>
    </aside>
  );
}
