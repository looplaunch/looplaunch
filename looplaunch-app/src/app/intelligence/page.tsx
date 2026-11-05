"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Copy, ExternalLink, ChevronRight, RotateCcw, Network, Lock, X } from "lucide-react";
import type {
  StatusResponse,
  PipelineStatus,
  ChatMessage,
} from "@/lib/intelligence/types";
import { MindMapDialog, parseMindMap } from "@/components/intelligence/MindMap";
import { MarkdownContent } from "@/components/intelligence/MarkdownContent";
import { IntelligenceSidebar } from "@/components/intelligence/IntelligenceSidebar";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { LockedResults } from "@/components/intelligence/LockedResults";
import { LoopyPuzzle } from "@/components/loopy/LoopyPuzzle";
import { LoopyTip } from "@/components/loopy/LoopyTip";
import LatticeLoader from "@/components/reactbits/LatticeLoader";
import BellToggle from "@/components/reactbits/BellToggle";
import SlingButton from "@/components/reactbits/SlingButton";
import { ResearchProgress } from "@/components/intelligence/ResearchProgress";
import { Tip } from "@/components/ui/Tip";
import { toast } from "@/lib/toast";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { LoginPrompt } from "@/components/auth/LoginPrompt";
import { LogoMenu } from "@/components/brand/LogoMenu";
import { PRIMARY_INLINE, SECONDARY_INLINE } from "@/components/ui/fields";
import { possessive } from "@/lib/intelligence/summary";
import { APP_HEADER_STYLE, PageTransition } from "@/components/app/PageTransition";
import { useAuthUser } from "@/lib/auth/use-auth-user";

// ──────────────────────────────────────────────
// Pipeline Stage Configuration
// ──────────────────────────────────────────────

/** Short words for the header while research runs. The wait screen shows the server's own statusMessage. */
const STAGE_LABELS: Record<PipelineStatus, string> = {
  idle: "Getting started",
  crawling_company: "Reading your website",
  crawling_competitors: "Searching Google",
  researching_market: "Searching Google",
  analyzing_company: "Profiling the business",
  analyzing_competitors: "Comparing competitors",
  analyzing_market: "Reading the market",
  diagnosing: "Writing the diagnosis",
  ready: "Strategy ready",
  error: "Research stopped",
};

/** How a new message arrives in the conversation. */
const ARRIVE = { duration: 0.32, ease: [0.22, 1, 0.36, 1] } as const;

/** The first strategy is generated automatically as soon as research finishes. */
const sevenDayPrompt = (company: string) =>
  `Build a prioritized 7-Day execution strategy for ${company}. Focus on fast customer traction, positioning that fits how its buyers really shop, short-form organic content, and the quickest ways to reach those buyers. Fit every step to this kind of business.`;

const fourteenDayPrompt = (company: string) =>
  `Build a comprehensive 14-Day marketing and growth strategy for ${company}. Cover positioning differentiation, short-form video content, competitor comparisons, the channels where its buyers already are, and conversion funnels. Fit every step to this kind of business.`;

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
  // Messages already saved when the page opened; only the ones after them animate in.
  const [baseCount, setBaseCount] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState("");
  const [latestStreamingMsgId, setLatestStreamingMsgId] = useState<string | null>(null);
  const [mindMapIndex, setMindMapIndex] = useState<number | null>(null);
  const user = useAuthUser();
  const claimedRef = useRef<string | null>(null);

  // Signed-out visitors watch the research run, then have to log in to see the results: the
  // status API sends them only once they're signed in (and the ask API won't answer before).
  const hasAnswer = messages.some((m) => m.role === "assistant");
  const chatLocked = user === null;
  const locked = status?.locked === true;
  const strategyPending = status?.strategyPending === true;
  const [loginOpen, setLoginOpen] = useState(false);
  const [resultsPromptDismissed, setResultsPromptDismissed] = useState(false);
  const [loginReason, setLoginReason] = useState<"results" | "chat" | "intel">("chat");
  const askToLogIn = (reason: "results" | "chat" | "intel") => {
    setLoginReason(reason);
    setLoginOpen(true);
  };
  const closeLogin = useCallback(() => {
    setLoginOpen(false);
    setResultsPromptDismissed(true);
  }, []);

  // Logged in with an anonymous analysis open: attach it to the account once, so it shows in History.
  useEffect(() => {
    if (!user || !sessionId || claimedRef.current === sessionId) return;
    claimedRef.current = sessionId;
    fetch("/api/intelligence/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => {});
  }, [user, sessionId]);
  const autoAskedRef = useRef(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Poll pipeline status & hydrate messages ───
  // Polling runs while the research runs, and after it while a first strategy someone already
  // asked for (before logging in, say) is still being written.
  const waitingForStrategy =
    !isGathering && status?.status === "ready" && !locked && !hasAnswer && !isAsking && (strategyPending || messages.length > 0);
  const keepPollingRef = useRef(true);
  useEffect(() => {
    keepPollingRef.current = isGathering || waitingForStrategy;
  }, [isGathering, waitingForStrategy]);

  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/intelligence/status?sessionId=${sessionId}`);
        if (!res.ok) {
          if (isMounted) {
            setError("We couldn't find this analysis. It may have been deleted, or the link may be wrong.");
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
          setBaseCount((b) => b ?? data.messages!.length);
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
          setError(data.error || "The research stopped before it finished.");
          setIsGathering(false);
        }
      } catch {
        // Retry on next interval cycle
      }
    };

    poll();

    const interval = setInterval(() => {
      if (keepPollingRef.current) poll();
    }, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId]);

  // ─── Auto-scroll to bottom of conversation ───
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isAsking]);

  // ─── Auto-resize textarea ───
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value);
    const target = e.target;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
    // Only scroll once the text hits the cap; below it a sub-pixel overflow shows a stray scrollbar
    target.style.overflowY = target.scrollHeight > 180 ? "auto" : "hidden";
  };

  // ─── Send Question ───
  const handleAsk = async (explicitQuestion?: string) => {
    if (chatLocked) {
      askToLogIn("chat");
      return;
    }
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
      inputRef.current.style.overflowY = "hidden";
    }

    try {
      const res = await fetch("/api/intelligence/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question: questionText }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 401 && errData.loginRequired) {
          // Signed out after the first answer: give the question back and ask them to log in.
          setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
          setQuestion(questionText);
          askToLogIn("chat");
          setIsAsking(false);
          return;
        }
        setError(errData.error || "Loopy couldn't answer that. Please try again.");
        setIsAsking(false);
        return;
      }

      const data = await res.json();

      if (data.pending || data.locked) {
        // Already being written (or saved for after login): polling brings it in.
        setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
        setStatus((s) => (s ? { ...s, strategyPending: true } : s));
        return;
      }

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
      setError("Couldn't reach Loop Launch. Check your connection and try again.");
    } finally {
      setIsAsking(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  // ─── Generate the 7-day strategy as soon as research is ready ───
  const isReady = !isGathering && status?.status === "ready";
  useEffect(() => {
    if (!isReady || autoAskedRef.current || messages.length > 0 || strategyPending || user === undefined) return;
    autoAskedRef.current = true;
    if (locked) {
      // Signed out: the strategy is written while they log in and shown afterwards.
      fetch("/api/intelligence/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, question: sevenDayPrompt(companyName) }),
      }).catch(() => {});
      return;
    }
    // Starting the request is this effect's job; it shows the question right away.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleAsk(sevenDayPrompt(companyName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, messages.length, strategyPending, locked, user]);

  // The results are ready but locked: the login pop-up opens by itself ("Not now" leaves the lock screen).
  const resultsPromptOpen = isReady && locked && !resultsPromptDismissed;

  const has14Day = messages.some((m) => m.role === "user" && autoPromptLabel(m.content) === "14-day strategy");
  // Nothing about the analysis is known until the first status answers: show a quiet loader, not
  // the research wait screen (a finished analysis would flash "Researching Company" first).
  const loaded = status !== null || Boolean(error);
  // One continuous wait (and one puzzle) from research through the first strategy.
  const showInitialWait =
    loaded &&
    (isGathering || (isReady && !locked && !hasAnswer && (isAsking || messages.length === 0 || waitingForStrategy) && !error));
  const showConversation = isReady && !locked && !showInitialWait;

  // "Notify me when it's ready": a browser notification once the strategy lands, if the tab is in the background.
  const [notify, setNotify] = useState(false);
  const wasWaitingRef = useRef(showInitialWait);
  useEffect(() => {
    const wasWaiting = wasWaitingRef.current;
    wasWaitingRef.current = showInitialWait;
    if (!wasWaiting || showInitialWait || !hasAnswer) return;
    if (notify && document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
      new Notification("Your Loop Launch plan is ready", { body: `Loopy has written the 7-day strategy for ${companyName}.`, icon: "/icon.png" });
    }
    if (notify) toast("Your plan is ready", { description: `The 7-day strategy for ${companyName} is below.` });
  }, [showInitialWait, hasAnswer, notify, companyName]);

  const toggleNotify = async (on: boolean) => {
    if (!on) {
      setNotify(false);
      return;
    }
    if (!("Notification" in window)) {
      setNotify(true);
      toast("We'll tell you here", { description: "This browser can't show notifications, so watch for a message on this page.", tone: "info" });
      return;
    }
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission === "denied") {
      setNotify(false);
      toast("Notifications are blocked", { description: "Allow them for this site in your browser settings, then try again.", tone: "error" });
      return;
    }
    setNotify(true);
    toast("We'll notify you", { description: "You can switch tabs; a notification arrives when the plan is written.", tone: "info" });
  };

  const copyAnswer = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast("Answer copied", { description: "Paste it into a doc or a message; headings and lists come with it." });
    } catch {
      toast("Couldn't copy", { description: "Your browser blocked the clipboard. Select the text and copy it instead.", tone: "error" });
    }
  };

  const mindMapMsg = mindMapIndex !== null ? messages[mindMapIndex] : undefined;
  const mindMapData = mindMapMsg ? parseMindMap(mindMapMsg.content, `${companyName} plan`) : null;

  // ─── No Session ID Fallback ───
  if (!sessionId) {
    return (
      <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex items-center justify-center p-4">
        <div className="w-full max-w-[400px] rounded-[20px] bg-[#111114] p-6 sm:p-8">
          <LoopyMascot size={44} />
          <h1 className="mt-4 text-[22px] leading-tight font-semibold tracking-[-0.01em]">No analysis open</h1>
          <p className="mt-2 text-[15px] leading-[1.5] text-[#B4B4BC]">
            This link doesn&apos;t point to an analysis. Open one from History, or start a new one.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/new" className={PRIMARY_INLINE}>
              Start an analysis
            </Link>
            <Link href="/history" className={SECONDARY_INLINE}>
              Open History
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <PageTransition>
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex flex-col font-sans selection:bg-[#8B5CF6]/20 selection:text-[#F4F4F5]">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 h-14 bg-[#09090B] border-b border-[#1C1C21]" style={APP_HEADER_STYLE}>
        <div className="h-full mx-auto max-w-[1148px] px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <LogoMenu
            note={
              user === null ? (
                <>
                  This analysis isn&apos;t saved to an account yet.{" "}
                  <Link
                    href={`/login?next=${encodeURIComponent(`/intelligence?session=${sessionId}`)}`}
                    className="text-[#F4F4F5] underline underline-offset-2"
                  >
                    Log in
                  </Link>{" "}
                  first if you want it in your History.
                </>
              ) : undefined
            }
          />
          {loaded && (
            <>
              <span className="ll-swap text-[14px] text-[#3F3F48]" aria-hidden="true">
                /
              </span>
              <span key={companyName} className="ll-swap text-[14px] font-medium text-[#F4F4F5] truncate max-w-[200px] sm:max-w-[320px]">
                {companyName}
              </span>
            </>
          )}
        </div>

        {/* While anything is running, say what; when it's done the header stays quiet */}
        <div className="flex items-center gap-4">
          {(showInitialWait || (status && status.status !== "ready" && status.status !== "error")) && (
            <div className="flex items-center gap-2 text-[13px] text-[#B4B4BC]">
              <span className="w-3.5 h-3.5 border-2 border-[#B4B4BC] border-t-transparent rounded-full animate-spin shrink-0" aria-hidden="true" />
              {(() => {
                const label = isReady ? "Writing your 7-day strategy" : status ? STAGE_LABELS[status.status] : "Getting started";
                return (
                  <span key={label} className="ll-swap hidden sm:inline-block">
                    {label}
                  </span>
                );
              })()}
              <span className="sm:hidden">Working</span>
            </div>
          )}
          <AccountMenu loginNext={`/intelligence?session=${sessionId}`} />
        </div>
        </div>
      </header>

      {/* ─── Main Content Container ─── (each state rises in as it lands: .ll-page) */}
      <main className="ll-page relative flex-1 flex flex-col w-full max-w-[1148px] mx-auto px-4 sm:px-6">
        {!loaded && (
          // Only shows if the first status takes a moment; a quick answer goes straight to the right screen.
          <div className="my-auto flex justify-center py-24 text-[#B4B4BC]" style={{ animationDelay: "0.35s" }}>
            <LatticeLoader label="Opening your analysis" pattern="orbit" fontSize={14} />
          </div>
        )}

        {/* ─── Pipeline Gathering State ─── (popLayout: the leaving wait screen fades without pushing the answer down) */}
        <AnimatePresence mode="popLayout">
          {showInitialWait && (
            <motion.div
              key="wait"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.25 } }}
              className="pt-12 sm:pt-16 pb-20 flex flex-col items-center text-center my-auto"
            >
              <h1 className="text-[26px] sm:text-[30px] leading-tight font-semibold tracking-[-0.02em] [text-wrap:balance]">
                {isReady ? "Writing your 7-day strategy" : `Researching ${companyName}`}
              </h1>
              <p className="mt-2 text-[16px] leading-6 text-[#B4B4BC] max-w-[52ch]">
                {isReady
                  ? `The research on ${companyName} is done. Loopy is turning it into a plan you can start this week.`
                  : "Loop Launch reads your website, then searches Google for your competitors, their ads and your buyers' questions. It takes a few minutes."}
              </p>

              {/* Loopy puzzle to play while the pipeline runs */}
              <LoopyPuzzle
                className="max-w-2xl mt-8 mb-8"
                messages={[
                  isReady ? "Writing your 7-day strategy…" : status?.statusMessage || "Getting started…",
                  `Loopy is studying ${companyName}…`,
                ]}
              />

              {/* The same four stages the dashboard and History show, with the server's own line for the step it's on */}
              <div className="w-full max-w-xl rounded-[20px] bg-[#111114] p-5 text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-[14px] text-[#F4F4F5] min-w-0 flex-1" aria-live="polite">
                    {(() => {
                      const line = isReady ? "Research done. Writing your 7-day strategy…" : status?.statusMessage || "Getting started…";
                      return (
                        <span key={line} className="ll-swap block">
                          {line}
                        </span>
                      );
                    })()}
                  </p>
                  {/* React Bits BellToggle: rings, then unfurls into "Notifying you" */}
                  <BellToggle
                    offLabel="Notify me"
                    onLabel="Notifying you"
                    label="Notify me when the plan is ready"
                    pressed={notify}
                    onChange={toggleNotify}
                    size="sm"
                    color="#D4D4D8"
                    background="#1C1C21"
                    onColor="#FFFFFF"
                    onBackground="#7C3AED"
                    radius={999}
                  />
                </div>
                <div className="mt-4">
                  <ResearchProgress status={status?.status} writing={isReady} companyName={companyName} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Results ready, signed out: log in to see them ─── */}
        {isReady && locked && (
          <LockedResults
            companyName={companyName}
            counts={status?.searchIntel?.counts}
            onLogIn={() => askToLogIn("results")}
          />
        )}

        {/* ─── Conversational Stream / Initial Selection ─── */}
        {showConversation && status && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 pt-4 pb-24 items-start">
            <div className="flex-1 flex flex-col w-full min-w-0">
            {!hasAnswer ? (
              /* ─── First strategy failed: let the user retry ─── */
              <div className="pt-16 pb-32 flex flex-col items-center text-center max-w-md mx-auto w-full">
                <LoopyMascot size={72} className="mb-4" />
                <h1 className="text-[22px] leading-tight font-semibold text-[#F4F4F5] mb-2">
                  Your research on {companyName} is ready
                </h1>
                <p className="text-[15px] text-[#B4B4BC] mb-6 leading-relaxed">
                  The 7-day strategy didn&apos;t come through. Try again, or ask your own question below.
                </p>
                <button type="button" onClick={() => handleAsk(sevenDayPrompt(companyName))} disabled={isAsking} className={PRIMARY_INLINE}>
                  Write my 7-day strategy
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              /* ─── Conversation Stream ─── */
              <div className="pt-6 pb-36 space-y-7">
                {messages.map((msg, index) => {
                  const lastAssistantIndex = messages.findLastIndex((m) => m.role === "assistant");
                  const isUser = msg.role === "user";

                  const autoLabel = isUser ? autoPromptLabel(msg.content) : null;
                  // Keyed by position: the list only grows, and a question's id changes once the server saves it.
                  const animateIn = baseCount === null || index >= baseCount;
                  if (autoLabel) {
                    return (
                      <motion.div
                        key={index}
                        initial={animateIn ? { opacity: 0 } : false}
                        animate={{ opacity: 1 }}
                        transition={ARRIVE}
                        className="flex items-center gap-3 pt-2 text-[13px] text-[#8B8B94]"
                      >
                        <div className="flex-1 h-px bg-[#1F1F24]" aria-hidden="true" />
                        <span>
                          Your {autoLabel} for {companyName}
                        </span>
                        <div className="flex-1 h-px bg-[#1F1F24]" aria-hidden="true" />
                      </motion.div>
                    );
                  }

                  if (isUser) {
                    return (
                      <motion.div
                        key={index}
                        initial={animateIn ? { opacity: 0, y: 10 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={ARRIVE}
                        className="flex justify-end pt-2"
                      >
                        <div className="bg-[#1C1C21] text-[#F4F4F5] rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[85%] sm:max-w-[78%]">
                          <p className="text-[15px] leading-relaxed font-normal whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      </motion.div>
                    );
                  }

                  // Assistant response
                  const isLatest = index === lastAssistantIndex;

                  return (
                    <motion.div
                      key={index}
                      initial={animateIn ? { opacity: 0, y: 12 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={ARRIVE}
                      className="pt-2 pb-6 border-b border-[#1C1C21] last:border-b-0 space-y-3"
                    >
                      {/* Advisor badge & timestamp */}
                      <div className="flex items-center justify-between text-[12px] text-[#B4B4BC]">
                        <div className="flex items-center gap-2">
                          <LoopyMascot size={22} mood="still" />
                          <span className="font-semibold text-[#F4F4F5] text-[14px]">Loopy</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {msg.timestamp && (
                            <span className="text-[12px] text-[#8B8B94] tabular-nums mr-1">
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                          <Tip label="Copy answer">
                            <button
                              type="button"
                              onClick={() => copyAnswer(msg.content)}
                              aria-label="Copy answer"
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[#8B8B94] hover:text-[#F4F4F5] hover:bg-[#1C1C21] active:scale-90 transition cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </Tip>
                        </div>
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
                          <div className="mt-5 pt-4 border-t border-[#1F1F24] space-y-2.5">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                              <span className="text-[14px] text-[#D4D4D8] font-medium">What this is based on</span>
                              {msg.researchStatus === "success" && (
                                <span className="text-[12px] text-[#8B8B94]">Checked against live web research</span>
                              )}
                            </div>

                            <div className="space-y-2">
                              {msg.evidence.map((ev, ei) => (
                                <div key={ei} className="bg-[#111114] rounded-[14px] px-4 py-3 text-[13px] space-y-1">
                                  <p className="text-[#D4D4D8] leading-relaxed">{ev.insight}</p>
                                  {ev.url ? (
                                    <div className="flex items-center gap-1 text-[12px] text-[#8B8B94]">
                                      <span>Source:</span>
                                      <a
                                        href={ev.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#B4B4BC] hover:text-[#F4F4F5] underline underline-offset-2 truncate flex items-center gap-1 max-w-[90%]"
                                        title={ev.url}
                                      >
                                        <span className="truncate">{ev.source || ev.url}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0 opacity-70" aria-hidden="true" />
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="text-[12px] text-[#8B8B94]">
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
                          <div className="mt-4">
                            <span className="text-[14px] text-[#D4D4D8] font-medium block mb-2">Sources</span>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.map((s, si) => (
                                <a
                                  key={si}
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#1C1C21] hover:bg-[#232329] text-[13px] text-[#B4B4BC] hover:text-[#F4F4F5] transition-colors max-w-[280px]"
                                  title={`${s.title} · ${s.url}`}
                                >
                                  <span className="truncate">{s.title || s.source}</span>
                                  <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Mind map + suggested next questions */}
                        <div className="mt-5 space-y-3">
                          <button type="button" onClick={() => setMindMapIndex(index)} className={SECONDARY_INLINE}>
                            <Network className="w-4 h-4 text-[#B4B4BC]" aria-hidden="true" />
                            See it as a mind map
                          </button>

                          {isLatest && (
                            <div>
                              <span className="block text-[14px] text-[#D4D4D8] font-medium mb-2">Ask Loopy next</span>
                              <div className="flex flex-wrap gap-2">
                                {suggestionsFor(msg, companyName, has14Day).map((fq, fi) => (
                                  <button
                                    key={fi}
                                    onClick={() => handleAsk(fq.prompt)}
                                    disabled={isAsking}
                                    style={{ "--d": `${0.2 + fi * 0.05}s` } as React.CSSProperties}
                                    className={`ll-rise text-[13px] min-h-9 px-3.5 py-1.5 rounded-full active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1 cursor-pointer text-left ${
                                      fq.primary
                                        ? "bg-[#F4F4F5] text-[#09090B] font-semibold hover:bg-white"
                                        : "bg-[#1C1C21] hover:bg-[#232329] text-[#D4D4D8] hover:text-[#F4F4F5]"
                                    }`}
                                  >
                                    <span>{fq.label}</span>
                                    <ChevronRight className="w-3.5 h-3.5 opacity-50 shrink-0" aria-hidden="true" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Thinking indicator */}
                {isAsking && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3 py-3 text-[#B4B4BC]"
                  >
                    <LoopyMascot size={32} mood="float" />
                    <LatticeLoader label="Loopy is working on your answer" pattern="orbit" fontSize={14} />
                  </motion.div>
                )}

                <div ref={bottomRef} className="scroll-mb-36" />
              </div>
            )}
            </div>

            {/* Right Column: Search Intel, built from stored research (no new searches) */}
            {status.searchIntel && (
              <IntelligenceSidebar
                intel={status.searchIntel}
                companyName={companyName}
                sessionId={sessionId}
                onAsk={(q) => handleAsk(q)}
                isAsking={isAsking}
                onUnlock={() => askToLogIn("intel")}
              />
            )}
          </div>
        )}

        {/* ─── Error State ─── */}
        {!isGathering && (status?.status === "error" || (Boolean(error) && status?.status !== "ready")) && (
          <div className="py-16 flex flex-col items-center my-auto text-center max-w-md mx-auto">
            <LoopyMascot size={56} />
            <h1 className="mt-4 text-[22px] leading-tight font-semibold text-[#F4F4F5]">
              {status?.status === "error" ? "The research didn't finish" : "We couldn't open this analysis"}
            </h1>
            <p className="mt-2 text-[15px] leading-[1.5] text-[#B4B4BC]">
              {error || status?.error || "Something went wrong while loading it. Please try again."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/new" className={PRIMARY_INLINE}>
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                Start a new analysis
              </Link>
              <Link href="/" className={SECONDARY_INLINE}>
                Back to home
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* ─── Sticky Bottom Question Input Bar ─── */}
      {showConversation && (
        <div className="ll-bar-in fixed bottom-0 left-0 right-0 z-30 bg-[#09090B] border-t border-[#1C1C21] px-4 py-3">
          <div className="max-w-3xl mx-auto w-full">
            {error && (
              <div role="alert" className="mb-2 pl-3.5 pr-1.5 py-1.5 rounded-xl bg-[#1C1C21] text-[13px] text-[#F87171] flex items-center justify-between gap-2">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Dismiss"
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[#B4B4BC] hover:text-white hover:bg-[#2A2A30] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {chatLocked ? (
              <>
                <button
                  type="button"
                  onClick={() => askToLogIn("chat")}
                  className="w-full flex items-center gap-3 bg-[#1C1C21] hover:bg-[#232329] rounded-2xl pl-4 pr-2 py-2 text-left transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-[#B4B4BC] shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-[14px] text-[#B4B4BC]">Log in to ask Loopy follow-up questions</span>
                  <span className="shrink-0 inline-flex items-center h-8 px-4 rounded-full bg-[#F4F4F5] text-[#09090B] text-[13px] font-semibold">
                    Log in
                  </span>
                </button>
                <p className="text-[12px] text-[#8B8B94] mt-1.5 px-1 text-center sm:text-left">
                  Logging in also shows the search intel and saves this analysis to your History.
                </p>
              </>
            ) : (
              <>
                <div className="relative flex items-end bg-[#1C1C21] border border-[#2E2E35] hover:border-[#3F3F48] focus-within:border-[#8B5CF6] rounded-2xl transition-colors">
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
                    aria-label={`Ask Loopy about ${companyName}`}
                    placeholder="Ask Loopy about this analysis…"
                    disabled={isAsking}
                    className="w-full bg-transparent text-[#F4F4F5] text-[15px] placeholder:text-[#8B8B94] px-4 py-3 pr-14 resize-none overflow-y-hidden focus:outline-none min-h-[48px] max-h-[180px] leading-relaxed"
                  />

                  {/* React Bits SlingButton: tap to send, or pull it back like a slingshot and let go */}
                  <span className="absolute right-1 bottom-1 flex">
                    <SlingButton
                      onSend={() => handleAsk()}
                      disabled={!question.trim() || isAsking}
                      ariaLabel="Send"
                      size={40}
                      gap={0}
                      strokeWidth={2}
                      padColor="#F4F4F5"
                      iconColor="#09090B"
                      accentColor="#8B5CF6"
                      wellColor="#1C1C21"
                      bandColor="#52525B"
                      particles={10}
                    />
                  </span>
                </div>

                <p className="text-[12px] text-[#8B8B94] mt-1.5 px-1 text-center sm:text-left">Press Enter to send, Shift + Enter for a new line</p>
              </>
            )}
          </div>
        </div>
      )}

      <LoginPrompt
        open={loginOpen || resultsPromptOpen}
        onClose={closeLogin}
        next={`/intelligence?session=${sessionId}`}
        title={
          resultsPromptOpen || loginReason === "results"
            ? "Log in to see your results"
            : loginReason === "intel"
              ? "Log in to see the search intel"
              : "Log in to keep chatting"
        }
        description={
          resultsPromptOpen || loginReason === "results"
            ? `Your analysis of ${companyName} is ready. Log in to see your 7-day strategy and everything Loopy found. It's saved to your History too.`
            : loginReason === "intel"
              ? `See what ${possessive(companyName)} buyers ask Google, the ads running in this market, and who you're up against.`
              : `Log in to ask Loopy follow-up questions about ${companyName} and save this analysis to your History.`
        }
      />

      {mindMapData && (
        <MindMapDialog
          key={mindMapIndex ?? "closed"}
          open={Boolean(mindMapMsg)}
          onClose={() => setMindMapIndex(null)}
          data={mindMapData}
        />
      )}
    </div>
    </PageTransition>
    </MotionConfig>
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
