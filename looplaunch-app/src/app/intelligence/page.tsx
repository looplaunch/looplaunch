"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUp,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Globe,
  Compass,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import type {
  StatusResponse,
  StrategicAnswer,
  PipelineStatus,
  ChatMessage,
} from "@/lib/intelligence/types";
import { MarkdownContent } from "@/components/intelligence/MarkdownContent";

// ──────────────────────────────────────────────
// Pipeline Stage Configuration
// ──────────────────────────────────────────────

const STAGE_LABELS: Record<PipelineStatus, string> = {
  idle: "Initializing intelligence engine...",
  crawling_company: "Deep crawling company website & assets",
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

// ──────────────────────────────────────────────
// Strategic Starter Questions
// ──────────────────────────────────────────────

const STARTER_QUESTIONS = [
  {
    category: "Competitive Position",
    query: "What is our biggest competitive weakness, and who is exploiting it?",
  },
  {
    category: "Strategic Direction",
    query: "What should we prioritize first to accelerate qualified pipeline?",
  },
  {
    category: "Positioning & Messaging",
    query: "How should we differentiate our value proposition from industry incumbents?",
  },
  {
    category: "Market Expansion",
    query: "What if we target enterprise buyers instead of mid-market?",
  },
];

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
            // Only update if server has newer or different messages
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
        // Retry on next cycle
      }
    };

    // Immediate initial fetch
    poll();

    // Set polling interval only while gathering
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

    // Optimistically update conversation stream
    setMessages((prev) => [...prev, optimisticUserMsg]);
    setIsAsking(true);
    setError("");
    setQuestion("");

    // Reset textarea height
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
        setError(errData.error || "Failed to generate strategic answer");
        setIsAsking(false);
        return;
      }

      const data = await res.json();

      // If server returned the updated messages array, sync with it
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
      setError("Network communication error. Please check your connection and try again.");
    } finally {
      setIsAsking(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  // ─── No Session ID ───
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#12141c] border border-zinc-800 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mx-auto mb-5 text-zinc-300">
            <Compass className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-semibold mb-2 tracking-tight">No Active Session</h2>
          <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
            Please launch an intelligence analysis from the home workspace or provide a valid session ID.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 text-zinc-950 font-medium text-sm hover:bg-white transition-colors"
          >
            ← Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col font-sans selection:bg-zinc-700 selection:text-white">
      {/* ─── Top Navigation Bar ─── */}
      <header className="sticky top-0 z-40 bg-[#090a0f]/90 backdrop-blur-md border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <Link
            href="/"
            className="text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors flex items-center gap-1.5"
          >
            ← Exit
          </Link>
          <div className="w-px h-4 bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Loop Launch"
              width={105}
              height={35}
              className="h-6 w-auto object-contain"
              priority
            />
            <span className="text-[11px] text-zinc-500 font-mono">/</span>
            <span className="text-xs text-zinc-400 font-medium truncate max-w-[200px]">
              {companyName}
            </span>
          </div>
        </div>

        {/* Status indicator (only shown while loading or on error) */}
        {status && status.status !== "ready" && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 font-medium">
              {STAGE_LABELS[status.status]}
            </div>
          </div>
        )}
      </header>

      {/* ─── Main Content Container ─── */}
      <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 sm:px-6">
        {/* ─── Pipeline Gathering State ─── */}
        <AnimatePresence>
          {isGathering && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="py-16 flex flex-col items-center justify-center my-auto"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-6 relative">
                <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              </div>

              <h2 className="text-xl font-semibold text-zinc-100 mb-1.5 tracking-tight">
                Synthesizing Company Intelligence
              </h2>
              <p className="text-xs text-zinc-400 mb-8 max-w-md text-center leading-relaxed">
                Analyzing public web footprints, competitive positioning, and category dynamics for {companyName}.
              </p>

              {/* Multi-step progress list */}
              <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-2">
                {STAGE_ORDER.map((stage) => {
                  const currentIdx = status ? STAGE_ORDER.indexOf(status.status) : -1;
                  const stageIdx = STAGE_ORDER.indexOf(stage);
                  const isComplete = currentIdx > stageIdx;
                  const isCurrent = status?.status === stage;

                  return (
                    <div
                      key={stage}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors ${
                        isCurrent
                          ? "bg-zinc-800/80 text-zinc-100 font-medium border border-zinc-700/60"
                          : isComplete
                          ? "text-zinc-400"
                          : "text-zinc-600"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-zinc-700 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{STAGE_LABELS[stage]}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Conversational Stream ─── */}
        {!isGathering && status?.status === "ready" && (
          <div className="flex-1 flex flex-col pt-6 pb-28">
            {/* Welcome banner when no messages yet */}
            {messages.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="my-auto py-10 flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-300 shadow-sm">
                  <Sparkles className="w-6 h-6 text-zinc-300" />
                </div>
                <h3 className="text-xl font-semibold text-zinc-100 mb-2 tracking-tight">
                  Strategic Advisor Active
                </h3>
                <p className="text-xs text-zinc-400 max-w-md mb-8 leading-relaxed">
                  Your intelligence profile is loaded. Ask direct questions, challenge assumptions, or explore scenarios. The advisor retains memory across the dialogue.
                </p>

                {/* Curated starter questions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl text-left">
                  {STARTER_QUESTIONS.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => handleAsk(item.query)}
                      className="group p-3.5 rounded-xl bg-zinc-900/50 hover:bg-zinc-850/80 border border-zinc-800 hover:border-zinc-700 transition-all text-left cursor-pointer"
                    >
                      <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 group-hover:text-zinc-400 block mb-1">
                        {item.category}
                      </span>
                      <p className="text-xs text-zinc-300 group-hover:text-zinc-100 font-medium leading-snug">
                        {item.query}
                      </p>
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="space-y-7">
                {messages.map((msg, index) => {
                  const isUser = msg.role === "user";

                  if (isUser) {
                    return (
                      <div key={msg.id || index} className="flex justify-end pt-2">
                        <div className="bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 rounded-2xl rounded-tr-xs px-4 py-2.5 max-w-[82%] sm:max-w-[75%] shadow-sm">
                          <p className="text-[14px] leading-relaxed font-normal whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // Assistant response
                  return (
                    <div
                      key={msg.id || index}
                      className="pt-2 pb-5 border-b border-zinc-850/70 last:border-b-0 space-y-3.5"
                    >
                      {/* Advisor badge & timestamp */}
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700/60 flex items-center justify-center p-0.5 overflow-hidden">
                            <Image
                              src="/logo-mark.png"
                              alt="Loop Launch"
                              width={16}
                              height={16}
                              className="w-3.5 h-3.5 object-contain"
                            />
                          </div>
                          <span className="font-semibold text-zinc-300 text-xs tracking-tight">
                            Strategy Advisor
                          </span>
                        </div>
                        {msg.timestamp && (
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>

                      {/* Main Advisor Markdown Content */}
                      <div className="pl-0.5 sm:pl-7">
                        <MarkdownContent
                          content={msg.content}
                          animate={msg.id === latestStreamingMsgId}
                        />

                        {/* Verified Evidence & Sources — ONLY rendered when present */}
                        {msg.evidence && msg.evidence.length > 0 && (
                          <div className="mt-4 pt-3.5 border-t border-zinc-800/80 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                Supporting Evidence
                              </span>
                              {msg.researchStatus === "success" && (
                                <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <Globe className="w-2.5 h-2.5" />
                                  Tavily Web Research
                                </span>
                              )}
                            </div>

                            <div className="space-y-2">
                              {msg.evidence.map((ev, ei) => (
                                <div
                                  key={ei}
                                  className="bg-zinc-900/60 border border-zinc-800/70 rounded-lg p-3 text-xs space-y-1"
                                >
                                  <p className="text-zinc-300 leading-relaxed font-normal">
                                    {ev.insight}
                                  </p>
                                  {ev.url ? (
                                    <div className="pt-1 flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                                      <span className="text-zinc-400">Source:</span>
                                      <a
                                        href={ev.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-zinc-300 hover:text-white underline underline-offset-2 truncate flex items-center gap-1 max-w-[90%]"
                                        title={ev.url}
                                      >
                                        <span className="truncate">{ev.source || ev.url}</span>
                                        <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="pt-1 text-[11px] text-zinc-400 font-mono">
                                      <span>Source: {ev.source}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Distinct Tavily Web References (if present) */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="mt-3 pt-2">
                            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium block mb-1.5">
                              Web Citations ({msg.sources.length})
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((s, si) => (
                                <a
                                  key={si}
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors max-w-[260px]"
                                  title={`${s.title} — ${s.url}`}
                                >
                                  <span className="truncate">{s.title || s.source}</span>
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Follow-up Prompts */}
                        {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                          <div className="mt-4 pt-3 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-zinc-400 font-medium mr-1">
                              Explore next:
                            </span>
                            {msg.followUpQuestions.map((fq, fi) => (
                              <button
                                key={fi}
                                onClick={() => handleAsk(fq)}
                                className="text-xs px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1 cursor-pointer"
                              >
                                <span>{fq}</span>
                                <ChevronRight className="w-3 h-3 opacity-60" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Thinking / Analyzing Indicator */}
                {isAsking && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 py-4 text-xs text-zinc-400 pl-0.5 sm:pl-7"
                  >
                    <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Analyzing dialogue context and strategic data...</span>
                  </motion.div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>
        )}

        {/* ─── Error State ─── */}
        {!isGathering && (status?.status === "error" || (Boolean(error) && status?.status !== "ready")) && (
          <div className="py-16 flex flex-col items-center my-auto">
            <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-red-800/40 flex items-center justify-center mb-4 text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100 mb-1">Session Error</h3>
            <p className="text-xs text-zinc-400 mb-6 max-w-sm text-center">
              {error || status?.error || "An error occurred while communicating with the intelligence service."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Start New Analysis
            </Link>
          </div>
        )}
      </div>

      {/* ─── Sticky Bottom Chat Input Bar ─── */}
      {!isGathering && status?.status === "ready" && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#090a0f]/95 backdrop-blur-lg border-t border-zinc-800/80 px-4 py-3.5">
          <div className="max-w-3xl mx-auto w-full">
            {error && (
              <div className="mb-2.5 px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center justify-between">
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  className="text-red-400 hover:text-red-200 text-xs ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="relative flex items-end bg-zinc-900/90 border border-zinc-750 rounded-xl focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500/20 transition-all shadow-md">
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
                placeholder="Ask a strategic question or follow up on the discussion..."
                disabled={isAsking}
                className="w-full bg-transparent text-zinc-100 text-sm placeholder:text-zinc-500 px-4 py-3 pr-12 resize-none focus:outline-none min-h-[44px] max-h-[180px] leading-relaxed"
              />

              <button
                onClick={() => handleAsk()}
                disabled={!question.trim() || isAsking}
                className="absolute right-2.5 bottom-2 w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-sm"
                title="Send message (Enter)"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 mt-2 px-1 text-center sm:text-left">
              <span>Press Enter to send · Shift + Enter for new line</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrap in Suspense boundary for useSearchParams
export default function IntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#090a0f] flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <IntelligencePageContent />
    </Suspense>
  );
}
