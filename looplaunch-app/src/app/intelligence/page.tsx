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
  Video,
  Calendar,
  Zap,
  Check,
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
            <Image
              src="/logo.png"
              alt="Loop Launch"
              width={96}
              height={32}
              className="h-5 w-auto object-contain"
              priority
            />
            <span className="text-[12px] text-[#71717A] font-mono">/</span>
            <span className="text-xs text-[#F4F4F5] font-medium bg-[#111114] border border-[#27272A] px-2 py-0.5 rounded truncate max-w-[180px]">
              {companyName}
            </span>
          </div>
        </div>

        {/* Status indicator */}
        <div>
          {isGathering || (status && status.status !== "ready") ? (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#111114] border border-[#27272A] text-[11px] text-[#A1A1AA] font-medium">
              <div className="w-3 h-3 border-2 border-[#A1A1AA] border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="hidden sm:inline">{status ? STAGE_LABELS[status.status] : "Analyzing..."}</span>
              <span className="sm:hidden">Synthesizing...</span>
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
      <main className="flex-1 flex flex-col w-full max-w-3xl mx-auto px-4 sm:px-6">
        {/* ─── Pipeline Gathering State ─── */}
        <AnimatePresence>
          {isGathering && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pt-16 pb-20 flex flex-col items-center justify-center text-center my-auto"
            >
              <div className="w-10 h-10 rounded-xl bg-[#111114] border border-[#27272A] flex items-center justify-center mb-5 relative">
                <div className="w-5 h-5 border-2 border-[#A1A1AA] border-t-transparent rounded-full animate-spin" />
              </div>

              <h2 className="text-xl font-semibold text-[#F4F4F5] mb-2 tracking-tight">
                Synthesizing Company Intelligence
              </h2>
              <p className="text-xs sm:text-sm text-[#A1A1AA] mb-8 max-w-md leading-relaxed">
                Analyzing public web footprints, competitive positioning, and market dynamics for {companyName}.
              </p>

              {/* Progress Stage List */}
              <div className="w-full max-w-md bg-[#111114] border border-[#27272A] rounded-xl p-3.5 space-y-1.5 text-left">
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
                      <span className="flex-1 truncate">{STAGE_LABELS[stage]}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Conversational Stream / Initial Selection ─── */}
        {!isGathering && status?.status === "ready" && (
          <div className="flex-1 flex flex-col">
            {messages.length === 0 ? (
              /* ─── Initial Strategy Selection Screen ─── */
              <div className="pt-10 sm:pt-14 pb-32 flex flex-col items-center text-center max-w-2xl mx-auto w-full">
                {/* Status Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#111114] border border-[#27272A] text-[12px] font-medium text-[#A1A1AA] mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  <span>Intelligence Profile Synthesized</span>
                </div>

                {/* Main Heading */}
                <h1 className="text-2xl sm:text-[28px] font-semibold text-[#F4F4F5] tracking-tight mb-2.5 leading-snug">
                  Choose an Execution Sprint for {companyName}
                </h1>
                <p className="text-sm text-[#A1A1AA] max-w-lg mb-8 leading-relaxed">
                  Your competitive landscape, customer acquisition bottlenecks, and market positioning are loaded. Select a structured roadmap to begin, or ask a custom question below.
                </p>

                {/* The 2 Primary Strategy Option Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-8 text-left">
                  {/* Card 1: 7-Day Sprint Strategy */}
                  <button
                    onClick={() =>
                      handleAsk(
                        `Build a prioritized 7-Day execution strategy for ${companyName}. Focus on fast customer traction, validated positioning hooks, short-form organic content, and immediate outbound steps.`
                      )
                    }
                    className="group relative p-5 sm:p-6 rounded-xl bg-[#111114] hover:bg-[#17171B] border border-[#27272A] hover:border-[#FACC15]/40 transition-all cursor-pointer flex flex-col justify-between text-left"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-mono font-medium tracking-wide px-2 py-0.5 rounded bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20 flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-[#FACC15]" />
                          7-DAY SPRINT
                        </span>
                        <span className="text-[11px] text-[#71717A] font-mono">Immediate Traction</span>
                      </div>
                      <h2 className="text-[17px] font-semibold text-[#F4F4F5] mb-1.5 tracking-tight group-hover:text-white transition-colors">
                        7-Day Strategy
                      </h2>
                      <p className="text-[13.5px] text-[#A1A1AA] leading-relaxed mb-5">
                        High-velocity execution sprint to test core messaging hooks, kickstart organic short-form video momentum, and drive immediate qualified leads.
                      </p>

                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                          <Check className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
                          <span>Friction audit & 1-sentence value hook</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                          <Check className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
                          <span>3 organic Reels/TikTok teardowns</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                          <Check className="w-3.5 h-3.5 text-[#FACC15] shrink-0" />
                          <span>Direct founder-led outbound loop</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3.5 border-t border-[#27272A] flex items-center justify-between text-xs font-medium text-[#FACC15]">
                      <span>Generate 7-Day Strategy</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>

                  {/* Card 2: 14-Day Growth Roadmap */}
                  <button
                    onClick={() =>
                      handleAsk(
                        `Build a comprehensive 14-Day marketing and growth strategy for ${companyName}. Cover positioning differentiation, short-form video content engines, competitor teardowns, outbound loops, and conversion funnels.`
                      )
                    }
                    className="group relative p-5 sm:p-6 rounded-xl bg-[#111114] hover:bg-[#17171B] border border-[#27272A] hover:border-[#8B5CF6]/40 transition-all cursor-pointer flex flex-col justify-between text-left"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-mono font-medium tracking-wide px-2 py-0.5 rounded bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-[#8B5CF6]" />
                          14-DAY ROADMAP
                        </span>
                        <span className="text-[11px] text-[#71717A] font-mono">Full Foundation</span>
                      </div>
                      <h2 className="text-[17px] font-semibold text-[#F4F4F5] mb-1.5 tracking-tight group-hover:text-white transition-colors">
                        14-Day Strategy
                      </h2>
                      <p className="text-[13.5px] text-[#A1A1AA] leading-relaxed mb-5">
                        Comprehensive multi-channel roadmap covering positioning contrast, video content loops, competitor teardowns, and automated conversion.
                      </p>

                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                          <Check className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                          <span>Competitive contrast & messaging moat</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                          <Check className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                          <span>5 targeted video teardown scripts</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">
                          <Check className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
                          <span>Outbound engine & conversion funnel</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3.5 border-t border-[#27272A] flex items-center justify-between text-xs font-medium text-[#8B5CF6]">
                      <span>Generate 14-Day Strategy</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                </div>

                {/* Subtle Divider */}
                <div className="w-full flex items-center gap-3 my-2 text-xs text-[#71717A]">
                  <div className="flex-1 h-px bg-[#27272A]" />
                  <span className="text-[12px] text-[#71717A]">or ask a specific strategic question below</span>
                  <div className="flex-1 h-px bg-[#27272A]" />
                </div>
              </div>
            ) : (
              /* ─── Conversation Stream ─── */
              <div className="pt-6 pb-36 space-y-7">
                {messages.map((msg, index) => {
                  const isUser = msg.role === "user";

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
                  const mentionsShortFormVideo =
                    /(tiktok|reels?|shorts?|short-form video)/i.test(msg.content);

                  return (
                    <div
                      key={msg.id || index}
                      className="pt-2 pb-6 border-b border-[#27272A]/70 last:border-b-0 space-y-3"
                    >
                      {/* Advisor badge & timestamp */}
                      <div className="flex items-center justify-between text-xs text-[#A1A1AA]">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-[#17171B] border border-[#27272A] flex items-center justify-center p-0.5 overflow-hidden">
                            <Image
                              src="/logo-mark.png"
                              alt="Loop Launch"
                              width={16}
                              height={16}
                              className="w-3.5 h-3.5 object-contain"
                            />
                          </div>
                          <span className="font-semibold text-[#F4F4F5] text-xs tracking-tight">
                            Strategy Advisor
                          </span>
                        </div>
                        {msg.timestamp && (
                          <span className="text-[11px] text-[#71717A] font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>

                      {/* Main Markdown Content */}
                      <div className="pl-0 sm:pl-7">
                        <MarkdownContent
                          content={msg.content}
                          animate={msg.id === latestStreamingMsgId}
                        />

                        {/* Interactive TikTok & Reel Scripts Card */}
                        {mentionsShortFormVideo && (
                          <div className="mt-4 p-4 rounded-xl bg-[#111114] border border-[#27272A] flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 flex items-center justify-center text-[#8B5CF6] shrink-0 mt-0.5 sm:mt-0">
                                <Video className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-semibold text-[#F4F4F5]">
                                    Short-Form Video Strategy Detected
                                  </span>
                                  <span className="text-[10px] font-mono text-[#8B5CF6] bg-[#8B5CF6]/10 px-1.5 py-0.2 rounded">
                                    REELS & TIKTOK
                                  </span>
                                </div>
                                <p className="text-[12px] text-[#A1A1AA] leading-snug">
                                  Would you like the complete scene-by-scene scripts with 3-second visual hooks, audio lines, and CTAs?
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                handleAsk(
                                  "Please generate the complete, ready-to-record scripts (3-second visual hooks, on-screen text, voiceover script, and CTA) for the recommended Reels and TikToks."
                                )
                              }
                              disabled={isAsking}
                              className="px-3.5 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Generate Scripts</span>
                              <ChevronRight className="w-3 h-3 opacity-70" />
                            </button>
                          </div>
                        )}

                        {/* Supporting Evidence */}
                        {msg.evidence && msg.evidence.length > 0 && (
                          <div className="mt-4 pt-3.5 border-t border-[#27272A] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-semibold flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                                Supporting Evidence
                              </span>
                              {msg.researchStatus === "success" && (
                                <span className="text-[10px] text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                                  <Globe className="w-2.5 h-2.5" />
                                  Tavily Web Research
                                </span>
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
                                    <div className="pt-0.5 flex items-center gap-1 text-[11px] text-[#71717A] font-mono">
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
                                    <div className="pt-0.5 text-[11px] text-[#71717A] font-mono">
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
                            <span className="text-[10px] uppercase tracking-wider text-[#71717A] font-medium block mb-1.5">
                              Web Citations ({msg.sources.length})
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

                        {/* Follow-up Prompts */}
                        {msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                          <div className="mt-4 pt-2.5 flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-[#71717A] font-medium mr-1">
                              Explore next:
                            </span>
                            {msg.followUpQuestions.map((fq, fi) => (
                              <button
                                key={fi}
                                onClick={() => handleAsk(fq)}
                                className="text-xs px-3 py-1.5 rounded-full border border-[#27272A] bg-[#111114] hover:bg-[#17171B] hover:border-[#3F3F46] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors flex items-center gap-1 cursor-pointer"
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
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 py-3 text-xs text-[#A1A1AA] pl-0 sm:pl-7"
                  >
                    <div className="w-3.5 h-3.5 border-2 border-[#A1A1AA] border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>Analyzing strategic framework and synthesizing recommendation...</span>
                  </motion.div>
                )}

                <div ref={bottomRef} />
              </div>
            )}
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
      {!isGathering && status?.status === "ready" && (
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
