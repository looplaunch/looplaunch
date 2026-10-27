"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUp,
  ExternalLink,
  ChevronRight,
  Compass,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Network,
} from "lucide-react";
import type {
  StatusResponse,
  PipelineStatus,
  ChatMessage,
} from "@/lib/intelligence/types";
import { MindMapDialog, parseMindMap } from "@/components/intelligence/MindMap";
import { MarkdownContent } from "@/components/intelligence/MarkdownContent";
import { IntelligenceSidebar } from "@/components/intelligence/IntelligenceSidebar";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { LoopyPuzzle } from "@/components/loopy/LoopyPuzzle";
import { LoopyTip } from "@/components/loopy/LoopyTip";

// ──────────────────────────────────────────────
// Pipeline Stage Configuration
// ──────────────────────────────────────────────

const STAGE_LABELS: Record<PipelineStatus, string> = {
  idle: "Initializing intelligence engine...",
  crawling_company: "Deep crawling company website & public assets",
  crawling_competitors: "Investigating competitive landscape",
  researching_market: "Synthesizing market category dynamics",
  analyzing_company: "Extracting core capabilities & positioning",
  analyzing_competitors: "Mapping competitive vulnerabilities & moats",
  analyzing_market: "Evaluating addressable demand & whitespace",
  diagnosing: "Synthesizing executive strategic diagnosis",
  ready: "Intelligence Active",
  error: "Analysis Interrupted",
};

const STAGE_ORDER: PipelineStatus[] = [
  "crawling_company",
  "crawling_competitors",
  "researching_market",
  "analyzing_company",
  "analyzing_competitors",
  "analyzing_market",
  "diagnosing",
  "ready",
];

/** The first strategy is generated automatically as soon as research finishes. */
const sevenDayPrompt = (company: string) =>
  `Build a prioritized 7-Day execution strategy for ${company}. Focus on fast customer traction, validated positioning hooks, short-form organic content, and immediate outbound steps.`;

const fourteenDayPrompt = (company: string) =>
  `Build a comprehensive 14-Day marketing and growth strategy for ${company}. Cover positioning differentiation, short-form video content engines, competitor teardowns, outbound loops, and conversion funnels.`;

/** Long built-in prompts are shown as a short divider label instead of a chat bubble. */
function autoPromptLabel(content: string): string | null {
  if (content.startsWith("Build a prioritized 7-Day execution strategy for")) return "7-day strategy";
  if (content.startsWith("Build a comprehensive 14-Day marketing and growth strategy for")) return "14-day strategy";
  return null;
}

interface Suggestion {
  label: string;
  prompt: string;
  primary?: boolean;
}

/** Extra next-step questions, used to top up whatever the AI suggests. */
const SUGGESTED_QUESTIONS = [
  "Write the scripts for the videos in this plan",
  "Turn this into a simple daily checklist",
  "What numbers should I track each day?",
  "How do I beat my biggest competitor?",
  "What should I do if nothing works by day 3?",
];

function suggestionsFor(msg: ChatMessage, company: string, has14Day: boolean): Suggestion[] {
  const fromAi = (msg.followUpQuestions ?? []).filter((q) => !/14[- ]day/i.test(q));
  const seen = new Set(fromAi.map((q) => q.toLowerCase()));
  const extra = SUGGESTED_QUESTIONS.filter((q) => !seen.has(q.toLowerCase()));
  const questions = [...fromAi, ...extra].slice(0, 5).map((q) => ({ label: q, prompt: q }));
  return has14Day
    ? questions
    : [{ label: "Get my 14-day strategy", prompt: fourteenDayPrompt(company), primary: true }, ...questions];
}

// ──────────────────────────────────────────────
// Main Intelligence Page Component
// ──────────────────────────────────────────────

function IntelligencePageContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  // Pipeline & Session state
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [isGathering, setIsGathering] = useState(true);
  const [companyName, setCompanyName] = useState<string>("Company");

  // Conversational state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState("");
  const [latestStreamingMsgId, setLatestStreamingMsgId] = useState<string | null>(null);
  const [mindMapIndex, setMindMapIndex] = useState<number | null>(null);
  const autoAskedRef = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Poll pipeline status & hydrate messages ───
  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/intelligence/status?sessionId=${sessionId}`);
        if (!res.ok) {
          if (isMounted) {
            setError("Session not found or expired. Please initialize a new session.");
            setIsGathering(false);
          }
          return;
        }
        const data: StatusResponse = await res.json();
        if (!isMounted) return;

        setStatus(data);
        if (data.companyName) {
          setCompanyName(data.companyName);
        }

        // Hydrate conversation messages from persistent session store
        if (data.messages && data.messages.length > 0) {
          setMessages((prev) => {
            if (prev.length === 0 || data.messages!.length >= prev.length) {
              return data.messages!;
            }
            return prev;
          });
        }

        if (data.status === "ready") {
          setIsGathering(false);
        } else if (data.status === "error") {
          setError(data.error || "An error occurred during intelligence synthesis.");
          setIsGathering(false);
        }
      } catch {
        // Retry on next interval cycle
      }
    };

    poll();

    const interval = setInterval(() => {
      if (isGathering) {
        poll();
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId, isGathering]);

  // ─── Auto-scroll to bottom of conversation ───
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  // ─── Auto-resize textarea ───
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
  };

  // ─── Send Question ───
  const handleAsk = async (explicitQuestion?: string) => {
    const questionText = (explicitQuestion || question).trim();
    if (!questionText || !sessionId || isAsking) return;

    const userMsgId = `user-${Date.now()}`;
    const optimisticUserMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: questionText,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsAsking(true);
    setError("");
    setQuestion("");

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/intelligence/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question: questionText }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to generate strategic response");
        setIsAsking(false);
        return;
      }

      const data = await res.json();

      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
        const lastMsg = data.messages[data.messages.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          setLatestStreamingMsgId(lastMsg.id || `stream-${Date.now()}`);
        }
      } else if (data.answer) {
        const newId = `assistant-${Date.now()}`;
        const assistantMsg: ChatMessage = {
          id: newId,
          role: "assistant",
          content: data.answer.answer,
          timestamp: new Date().toISOString(),
          evidence: data.answer.evidence,
          sources: data.answer.sources,
          confidence: data.answer.confidence,
          followUpQuestions: data.answer.followUpQuestions,
          researchStatus: data.answer.researchStatus,
          queryIntent: data.answer.queryIntent,
        };
        setLatestStreamingMsgId(newId);
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch {
      setError("Network error. Please verify your connection and try again.");
    } finally {
      setIsAsking(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  // ─── Generate the 7-day strategy as soon as research is ready ───
  const isReady = !isGathering && status?.status === "ready";
  useEffect(() => {
    if (!isReady || autoAskedRef.current || messages.length > 0) return;
    autoAskedRef.current = true;
    handleAsk(sevenDayPrompt(companyName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, messages.length]);

  const hasAnswer = messages.some((m) => m.role === "assistant");
  const has14Day = messages.some((m) => m.role === "user" && autoPromptLabel(m.content) === "14-day strategy");
  // One continuous wait (and one puzzle) from research through the first strategy.
  const showInitialWait = isGathering || (isReady && !hasAnswer && (isAsking || messages.length === 0) && !error);
  const showConversation = isReady && !showInitialWait;

  const mindMapMsg = mindMapIndex !== null ? messages[mindMapIndex] : undefined;
  const mindMapData = mindMapMsg ? parseMindMap(mindMapMsg.content, `${companyName} plan`) : null;

  // ─── No Session ID Fallback ───
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111114] border border-[#27272A] rounded-xl p-8 text-center shadow-lg">
          <div className="w-10 h-10 rounded-lg bg-[#17171B] border border-[#27272A] flex items-center justify-center mx-auto mb-4 text-[#A1A1AA]">
            <Compass className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-[#F4F4F5] mb-2 tracking-tight">
            No Active Session
          </h2>
          <p className="text-sm text-[#A1A1AA] mb-6 leading-relaxed">
            Please initialize an intelligence analysis from the home workspace or provide a valid session ID.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#F4F4F5] text-[#09090B] font-medium text-xs hover:bg-white transition-colors"
          >
            ← Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex flex-col font-sans selection:bg-[#8B5CF6]/20 selection:text-[#F4F4F5]">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 h-14 bg-[#09090B]/95 backdrop-blur-md border-b border-[#27272A] px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors flex items-center gap-1.5"
          >
            ← Home
          </Link>
          <div className="w-px h-3.5 bg-[#27272A]" />
          <div className="flex items-center gap-2">
            <LoopyMascot size={28} />
            <Image
              src="/logo.png"
              alt="Loop Launch"
              width={96}
              height={32}
              className="h-5 w-auto object-contain"
              priority
            />
            <span className="text-[12px] text-[#52525B]">/</span>
            <span className="text-xs text-[#F4F4F5] font-medium bg-[#111114] border border-[#27272A] px-2 py-0.5 rounded truncate max-w-[180px]">
              {companyName}
            </span>
          </div>
        </div>

        {/* Status indicator */}
        <div>
          {showInitialWait || (status && status.status !== "ready") ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111114] border border-[#27272A] text-[11px] text-[#A1A1AA] font-medium">
              <div className="w-3 h-3 border-2 border-[#A1A1AA] border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="hidden sm:inline">
                {isReady ? "Writing your 7-day strategy" : status ? STAGE_LABELS[status.status] : "Analyzing..."}
              </span>
              <span className="sm:hidden">Working...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              <span className="text-[12px] font-medium">Active</span>
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Content Container ─── */}
      <main className="flex-1 flex flex-col w-full max-w-6xl mx-auto px-4 sm:px-6">
        {/* ─── Pipeline Gathering State ─── */}
        <AnimatePresence>
          {showInitialWait && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pt-16 pb-20 flex flex-col items-center justify-center text-center my-auto"
            >
              <h2 className="text-xl font-semibold text-[#F4F4F5] mb-2 tracking-tight">
                Synthesizing Company Intelligence
              </h2>
              <p className="text-xs sm:text-sm text-[#A1A1AA] mb-6 max-w-md leading-relaxed">
                Analyzing public web footprints, competitive positioning, and market dynamics for {companyName}.
              </p>

              {/* Loopy puzzle to play while the pipeline runs */}
              <LoopyPuzzle
                className="max-w-2xl mb-8"
                messages={[
                  isReady
                    ? "Writing your 7-day strategy..."
                    : status
                      ? STAGE_LABELS[status.status]
                      : "Warming up the intelligence engine...",
                  `Loopy is studying ${companyName}...`,
                ]}
              />

              {/* Progress Stage List */}
              <div className="w-full max-w-md bg-[#111114] border border-[#27272A] rounded-xl p-3.5 space-y-1.5 text-left">
                {STAGE_ORDER.map((stage) => {
                  const currentIdx = status ? STAGE_ORDER.indexOf(status.status) : -1;
                  const stageIdx = STAGE_ORDER.indexOf(stage);
                  const isComplete = currentIdx > stageIdx || (stage === "ready" && hasAnswer);
                  const isCurrent = status?.status === stage;

                  return (
                    <div
                      key={stage}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                        isCurrent
                          ? "bg-[#17171B] text-[#F4F4F5] font-medium border border-[#27272A]"
                          : isComplete
                          ? "text-[#A1A1AA]"
                          : "text-[#52525B]"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                      ) : isCurrent ? (
                        <div className="w-3 h-3 border-2 border-[#F4F4F5] border-t-transparent rounded-full animate-spin shrink-0" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-[#3F3F46] shrink-0" />
                      )}
                      <span className="flex-1 truncate">
                        {stage === "ready" ? "Writing your 7-day strategy" : STAGE_LABELS[stage]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Conversational Stream / Initial Selection ─── */}
        {showConversation && status && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 pt-4 pb-24 items-start">
            <div className="flex-1 flex flex-col w-full min-w-0">
            {!hasAnswer ? (
              /* ─── First strategy failed: let the user retry ─── */
              <div className="pt-16 pb-32 flex flex-col items-center text-center max-w-md mx-auto w-full">
                <LoopyMascot size={72} className="mb-4" />
                <h1 className="text-xl font-semibold text-[#F4F4F5] mb-2">
                  Your research on {companyName} is ready
                </h1>
                <p className="text-sm text-[#A1A1AA] mb-6 leading-relaxed">
                  The 7-day strategy didn&apos;t come through. Try again, or ask your own question below.
                </p>
                <button
                  type="button"
                  onClick={() => handleAsk(sevenDayPrompt(companyName))}
                  disabled={isAsking}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F4F4F5] text-[#09090B] text-sm font-medium hover:bg-white disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Write my 7-day strategy
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* ─── Conversation Stream ─── */
              <div className="pt-6 pb-36 space-y-7">
                {messages.map((msg, index) => {
                  const lastAssistantIndex = messages.findLastIndex((m) => m.role === "assistant");
                  const isUser = msg.role === "user";

                  const autoLabel = isUser ? autoPromptLabel(msg.content) : null;
                  if (autoLabel) {
                    return (
                      <div key={msg.id || index} className="flex items-center gap-3 pt-2 text-xs text-[#71717A]">
                        <div className="flex-1 h-px bg-[#27272A]" />
                        <span>Your {autoLabel} for {companyName}</span>
                        <div className="flex-1 h-px bg-[#27272A]" />
                      </div>
                    );
                  }

                  if (isUser) {
                    return (
                      <div key={msg.id || index} className="flex justify-end pt-2">
                        <div className="bg-[#17171B] text-[#F4F4F5] border border-[#27272A] rounded-xl rounded-tr-xs px-4 py-2.5 max-w-[85%] sm:max-w-[78%]">
                          <p className="text-[14px] leading-relaxed font-normal whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // Assistant response
                  const isLatest = index === lastAssistantIndex;

                  return (
                    <div
                      key={msg.id || index}
                      className="pt-2 pb-6 border-b border-[#27272A]/70 last:border-b-0 space-y-3"
                    >
                      {/* Advisor badge & timestamp */}
                      <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
                        <div className="flex items-center gap-2">
                          <LoopyMascot size={22} mood="still" />
                          <span className="font-semibold text-[#F4F4F5] text-[13px]">
                            Loopy
                          </span>
                        </div>
                        {msg.timestamp && (
                          <span className="text-xs text-[#71717A] tabular-nums">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>

                      {/* Main Markdown Content */}
                      <div className="pl-0 sm:pl-7">
                        {isLatest && (
                          <LoopyTip key={msg.id || index} content={msg.content} seed={msg.id || String(index)} />
                        )}
                        <MarkdownContent
                          content={msg.content}
                          animate={msg.id === latestStreamingMsgId}
                        />

                        {/* Supporting Evidence */}
                        {msg.evidence && msg.evidence.length > 0 && (
                          <div className="mt-4 pt-3.5 border-t border-[#27272A] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] text-[#A1A1AA] font-medium">
                                What this is based on
                              </span>
                              {msg.researchStatus === "success" && (
                                <span className="text-xs text-[#71717A]">Checked against live web research</span>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              {msg.evidence.map((ev, ei) => (
                                <div
                                  key={ei}
                                  className="bg-[#111114] border border-[#27272A] rounded-lg p-3 text-xs space-y-1"
                                >
                                  <p className="text-[#D4D4D8] leading-relaxed">
                                    {ev.insight}
                                  </p>
                                  {ev.url ? (
                                    <div className="pt-0.5 flex items-center gap-1 text-xs text-[#71717A]">
                                      <span>Source:</span>
                                      <a
                                        href={ev.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#A1A1AA] hover:text-[#F4F4F5] underline underline-offset-2 truncate flex items-center gap-1 max-w-[90%]"
                                        title={ev.url}
                                      >
                                        <span className="truncate">{ev.source || ev.url}</span>
                                        <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="pt-0.5 text-xs text-[#71717A]">
                                      <span>Source: {ev.source}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Web Citations */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-2">
                            <span className="text-[13px] text-[#A1A1AA] font-medium block mb-1.5">
                              Sources
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((s, si) => (
                                <a
                                  key={si}
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#111114] border border-[#27272A] hover:border-[#3F3F46] text-[11px] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors max-w-[260px]"
                                  title={`${s.title} — ${s.url}`}
                                >
                                  <span className="truncate">{s.title || s.source}</span>
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Mind map + suggested next questions */}
                        <div className="mt-5 space-y-3">
                          <button
                            type="button"
                            onClick={() => setMindMapIndex(index)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#3F3F46] bg-[#17171B] hover:bg-[#1F1F24] text-[13px] font-medium text-[#F4F4F5] transition-colors cursor-pointer"
                          >
                            <Network className="w-4 h-4 text-[#F472B6]" />
                            See it as a mind map
                          </button>

                          {isLatest && (
                            <div>
                              <span className="block text-[13px] text-[#A1A1AA] font-medium mb-2">
                                Ask Loopy next
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {suggestionsFor(msg, companyName, has14Day).map((fq, fi) => (
                                  <button
                                    key={fi}
                                    onClick={() => handleAsk(fq.prompt)}
                                    disabled={isAsking}
                                    className={`text-[13px] px-3 py-1.5 rounded-full border disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer text-left ${
                                      fq.primary
                                        ? "bg-[#F4F4F5] border-[#F4F4F5] text-[#09090B] font-medium hover:bg-white"
                                        : "border-[#27272A] bg-[#111114] hover:bg-[#17171B] hover:border-[#3F3F46] text-[#D4D4D8] hover:text-[#F4F4F5]"
                                    }`}
                                  >
                                    <span>{fq.label}</span>
                                    <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Thinking indicator */}
                {isAsking && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 py-3 text-[13px] text-[#A1A1AA]"
                  >
                    <LoopyMascot size={32} />
                    <span>Loopy is working on your answer...</span>
                  </motion.div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
            </div>

            {/* Right Column: Live SerpApi Search & Ads Intelligence Sidebar */}
            <IntelligenceSidebar
              marketIntelligence={status.marketIntelligence}
              competitorIntelligence={status.competitorIntelligence}
              companyName={companyName}
              sessionId={sessionId}
              onAsk={(q) => handleAsk(q)}
              isAsking={isAsking}
            />
          </div>
        )}

        {/* ─── Error State ─── */}
        {!isGathering && (status?.status === "error" || (Boolean(error) && status?.status !== "ready")) && (
          <div className="py-16 flex flex-col items-center my-auto text-center">
            <div className="w-10 h-10 rounded-xl bg-red-950/40 border border-red-800/40 flex items-center justify-center mb-4 text-red-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-[#F4F4F5] mb-1">Session Error</h3>
            <p className="text-xs text-[#A1A1AA] mb-6 max-w-sm">
              {error || status?.error || "An error occurred while communicating with the intelligence service."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#17171B] hover:bg-[#27272A] border border-[#27272A] text-[#F4F4F5] text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Start New Analysis
            </Link>
          </div>
        )}
      </main>

      {/* ─── Sticky Bottom Question Input Bar ─── */}
      {showConversation && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#09090B]/95 backdrop-blur-md border-t border-[#27272A] px-4 py-3">
          <div className="max-w-3xl mx-auto w-full">
            {error && (
              <div className="mb-2 px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  className="text-red-400 hover:text-red-200 text-xs ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="relative flex items-end bg-[#111114] border border-[#27272A] focus-within:border-[#3F3F46] rounded-xl transition-all shadow-sm">
              <textarea
                ref={inputRef}
                rows={1}
                value={question}
                onChange={handleTextareaInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                placeholder="Ask a strategic question or follow up on your execution roadmap..."
                disabled={isAsking}
                className="w-full bg-transparent text-[#F4F4F5] text-sm placeholder:text-[#52525B] px-4 py-3 pr-12 resize-none focus:outline-none min-h-[46px] max-h-[180px] leading-relaxed"
              />

              <button
                onClick={() => handleAsk()}
                disabled={!question.trim() || isAsking}
                className="absolute right-2.5 bottom-2 w-8 h-8 rounded-lg bg-[#F4F4F5] text-[#09090B] flex items-center justify-center hover:bg-white disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer"
                title="Send message (Enter)"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="text-[11px] text-[#71717A] mt-1.5 px-1 text-center sm:text-left">
              <span>Press Enter to send · Shift + Enter for new line</span>
            </div>
          </div>
        </div>
      )}

      {mindMapData && (
        <MindMapDialog
          open={Boolean(mindMapMsg)}
          onClose={() => setMindMapIndex(null)}
          data={mindMapData}
          onAsk={(q) => handleAsk(q)}
        />
      )}
    </div>
  );
}

export default function IntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-[#A1A1AA] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <IntelligencePageContent />
    </Suspense>
  );
}
