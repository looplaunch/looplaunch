"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { BriefPanel } from "./BriefPanel";
import JellyRadio from "@/components/reactbits/JellyRadio";
import SlideCommit from "@/components/reactbits/SlideCommit";
import SpringCheck from "@/components/reactbits/SpringCheck";
import { useOnboarding } from "@/lib/onboarding/context";
import {
  STEPS,
  ROLE_OPTIONS,
  INDUSTRY_OPTIONS,
  STAGE_OPTIONS,
  AUDIENCE_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  HEADACHE_OPTIONS,
  THIRTY_DAY_GOAL_OPTIONS,
} from "@/lib/onboarding/types";
import { isValidUrl, normalizeUrl } from "@/lib/onboarding/validation";

/** Maps single-select step keys to their option arrays */
const SINGLE_SELECT_OPTIONS: Record<string, string[]> = {
  role: ROLE_OPTIONS,
  industry: INDUSTRY_OPTIONS,
  stage: STAGE_OPTIONS,
  biggestHeadache: HEADACHE_OPTIONS,
  thirtyDayGoal: THIRTY_DAY_GOAL_OPTIONS,
};

/** Maps multi-select step keys to their option arrays */
const MULTI_SELECT_OPTIONS: Record<string, string[]> = {
  audience: AUDIENCE_OPTIONS,
  salesChannels: SALES_CHANNEL_OPTIONS,
};

/**
 * The nine questions on the signed-in New analysis page (/new): each question on the left, the
 * visitor's brief filling in on the right, then a slide to start the research.
 */
export function QuestionFlow() {
  const router = useRouter();
  const {
    data,
    updateField,
    currentStepIndex,
    currentStep,
    goNext,
    goPrev,
    goToStep,
    canGoPrev,
    clearSaved,
  } = useOnboarding();

  // Intelligence pipeline submission state
  const [submitError, setSubmitError] = useState("");
  const startedSession = useRef<string | null>(null);

  // ─── Website step state (step 1) ───
  const [domainInput, setDomainInput] = useState(() => {
    return (data.website || "").replace(/^https?:\/\//i, "").trim();
  });
  const [websiteError, setWebsiteError] = useState("");
  const [websiteFocused, setWebsiteFocused] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const cleanDomain = domainInput
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split("?")[0];

  const hasValidDomain =
    cleanDomain.includes(".") &&
    cleanDomain.length >= 4 &&
    !cleanDomain.endsWith(".");

  // Follow the saved website when it changes elsewhere (the closing form, a restored session)
  const [seenWebsite, setSeenWebsite] = useState(data.website);
  if (data.website !== seenWebsite) {
    setSeenWebsite(data.website);
    if (data.website) setDomainInput(data.website.replace(/^https?:\/\//i, "").trim());
  }

  // ─── Generic question state (text/textarea steps) ───
  const currentField = currentStep.field;
  const currentVal = currentField
    ? typeof data[currentField] === "string"
      ? (data[currentField] as string)
      : ""
    : "";
  const [questionVal, setQuestionVal] = useState(currentVal);
  const [questionError, setQuestionError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A new question starts from its saved answer
  const [seenStep, setSeenStep] = useState(currentStep.key);
  if (currentStep.key !== seenStep) {
    setSeenStep(currentStep.key);
    if (currentField) {
      const val = data[currentField];
      setQuestionVal(typeof val === "string" ? val : "");
      setQuestionError("");
    }
  }

  useEffect(() => {
    // Auto-focus input when step changes
    if (
      currentStepIndex > 0 &&
      currentStep.key !== "review" &&
      currentStep.inputType === "text"
    ) {
      setTimeout(() => inputRef.current?.focus(), 200);
    } else if (currentStep.inputType === "textarea") {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [currentStepIndex, currentField, data, currentStep]);

  // ─── Handlers ───

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    val = val.replace(/^https?:\/\//i, "");
    setDomainInput(val);
    setFaviconError(false);
    if (websiteError) setWebsiteError("");
  };

  const handleWebsiteSubmit = () => {
    const trimmed = domainInput.trim();
    if (!trimmed) {
      setWebsiteError("Please enter your company website.");
      return;
    }
    const fullUrl = `https://${trimmed}`;
    if (!isValidUrl(fullUrl)) {
      setWebsiteError("Please enter a valid website URL (e.g. yourcompany.com)");
      return;
    }
    setWebsiteError("");
    const normalized = normalizeUrl(fullUrl);
    updateField("website", normalized);
    goNext();
  };

  const handleTextSubmit = () => {
    if (currentField) {
      const trimmed = questionVal.trim();
      if (!currentStep.optional && !trimmed) {
        setQuestionError("Please provide an answer before continuing.");
        return;
      }
      setQuestionError("");
      updateField(currentField, trimmed);
    }
    goNext();
  };

  const handleSkip = () => {
    if (currentField) {
      updateField(currentField, "");
    }
    goNext();
  };

  // ─── Single-select handler ───
  const handleSingleSelect = (option: string) => {
    if (currentField) {
      updateField(currentField, option);
      setQuestionError("");
      // Auto-advance once the chosen chip has had a moment to swell
      setTimeout(() => goNext(), 420);
    }
  };

  // ─── Multi-select handler ───
  const getMultiSelectValue = (): string[] => {
    if (!currentField) return [];
    const val = data[currentField];
    return Array.isArray(val) ? val : [];
  };

  const toggleMultiSelect = (option: string) => {
    if (!currentField) return;
    const current = getMultiSelectValue();
    const maxSelections = currentStep.maxSelections;

    if (current.includes(option)) {
      updateField(currentField, current.filter((r) => r !== option));
    } else {
      // Enforce max selections
      if (maxSelections && current.length >= maxSelections) {
        setQuestionError(`Pick up to ${maxSelections}.`);
        return;
      }
      updateField(currentField, [...current, option]);
    }
    if (questionError) setQuestionError("");
  };

  const handleMultiSelectSubmit = () => {
    const selected = getMultiSelectValue();
    if (selected.length === 0) {
      setQuestionError("Pick at least one option.");
      return;
    }
    setQuestionError("");
    goNext();
  };

  // ─── Launch intelligence pipeline ───
  // The slider waits on this promise: it spins while the request runs, then shows done or the error.
  const startResearch = async () => {
    setSubmitError("");
    let res: Response;
    try {
      res = await fetch("/api/intelligence/gather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (err) {
      setSubmitError("Network error. Please check your connection.");
      throw err;
    }
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: "Server error" }));
      const message = errData.error || "Failed to start intelligence gathering.";
      setSubmitError(message);
      throw new Error(message);
    }
    const result = await res.json();
    startedSession.current = result.sessionId;
  };

  const openStartedAnalysis = () => {
    if (!startedSession.current) return;
    // The answers now live in the analysis; coming back to the home page starts fresh.
    clearSaved();
    router.push(`/intelligence?session=${startedSession.current}`);
  };

  // ─── Step classification ───
  const isWebsiteStep = currentStep.key === "website";
  const isSingleSelectStep = currentStep.inputType === "singleselect";
  const isMultiSelectStep = currentStep.inputType === "multiselect";
  const isReviewStep = currentStep.key === "review";
  const isTextStep =
    !isWebsiteStep && !isSingleSelectStep && !isMultiSelectStep && !isReviewStep;

  // Get current single-select value
  const currentSingleVal = currentField
    ? typeof data[currentField] === "string"
      ? (data[currentField] as string)
      : ""
    : "";

  const questionNumber = Math.min(currentStepIndex + 1, STEPS.length - 1);

  const stepHeading = (text: string) => (
    <h1
      className="text-[26px] sm:text-[30px] leading-tight font-semibold tracking-[-0.02em] text-[#F4F4F5] mb-3 [text-wrap:balance]"
    >
      {text}
    </h1>
  );
  const stepSubtext = (text: string) => (
    <p className="text-[17px] leading-relaxed text-[#B4B4BC] mb-7 max-w-[46ch]">{text}</p>
  );
  const errorLine = (id: string | undefined, text: string) => (
    <p id={id} role="alert" className="mt-3 text-[14px] text-error pl-4">
      {text}
    </p>
  );
  const primaryButton =
    "inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full text-[15px] font-semibold bg-[#F4F4F5] text-[#09090B] hover:bg-white active:scale-[0.98] transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100";
  const stepMotion = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.24, ease: "easeOut" as const },
  };

  const steps = (
    <AnimatePresence mode="wait">
      {/* WEBSITE STEP (Q1) */}
      {isWebsiteStep && (
        <motion.div key="step-website" {...stepMotion} className="w-full">
          {stepHeading(currentStep.heading)}
          {stepSubtext(currentStep.subtext)}

          <div className="w-full max-w-lg">
            <label htmlFor="hero-website-input" className="block text-[15px] text-[#B4B4BC] mb-2">
              Your website
            </label>
            <div
              className={`flex items-center w-full h-14 pl-4 pr-1.5 gap-2.5 rounded-full bg-[#141418] border transition-[border-color,transform] duration-200 ${
                websiteError ? "border-error" : websiteFocused ? "border-[#8B5CF6] scale-[1.015]" : "border-[#2E2E35] hover:border-[#3F3F48]"
              }`}
            >
              <div className="w-5 h-5 flex items-center justify-center shrink-0">
                {hasValidDomain && !faviconError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={cleanDomain}
                    src={`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`}
                    alt=""
                    className="w-4 h-4 rounded-sm object-contain animate-fade-in"
                    onError={() => setFaviconError(true)}
                  />
                ) : (
                  <svg className="w-4 h-4 text-[#8B8B94]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                )}
              </div>
              <input
                id="hero-website-input"
                type="text"
                inputMode="url"
                value={domainInput}
                onChange={handleDomainChange}
                onFocus={() => setWebsiteFocused(true)}
                onBlur={() => setWebsiteFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleWebsiteSubmit();
                  }
                }}
                placeholder="yourcompany.com"
                spellCheck={false}
                autoComplete="off"
                aria-invalid={!!websiteError}
                aria-describedby={websiteError ? "hero-website-error" : "hero-website-note"}
                className="flex-1 min-w-0 bg-transparent text-[17px] text-[#F4F4F5] placeholder:text-[#8B8B94] focus:outline-none border-0 outline-none ring-0 p-0"
              />
              <button onClick={handleWebsiteSubmit} className={`${primaryButton} shrink-0 h-11`}>
                Analyse my site
              </button>
            </div>
            {websiteError ? (
              errorLine("hero-website-error", websiteError)
            ) : (
              <p id="hero-website-note" className="mt-3 text-[15px] text-[#B4B4BC] pl-4">
                Nine quick questions come next, then the research runs.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* TEXT / TEXTAREA STEPS */}
      {isTextStep && (
        <motion.div key={`step-${currentStep.key}`} {...stepMotion} className="w-full">
          {stepHeading(currentStep.heading)}
          {stepSubtext(currentStep.subtext)}

          <div className="w-full max-w-lg">
            {currentStep.inputType === "text" ? (
              <div className="flex items-center w-full h-14 pl-4 pr-1.5 gap-2 rounded-full bg-[#141418] border border-[#2E2E35] hover:border-[#3F3F48] focus-within:border-[#8B5CF6] transition-colors">
                <input
                  ref={inputRef}
                  type="text"
                  aria-label={currentStep.heading}
                  value={questionVal}
                  onChange={(e) => {
                    setQuestionVal(e.target.value);
                    if (questionError) setQuestionError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleTextSubmit();
                    }
                  }}
                  placeholder={currentStep.placeholder}
                  spellCheck={false}
                  autoComplete="off"
                  className="flex-1 min-w-0 bg-transparent text-[17px] text-[#F4F4F5] placeholder:text-[#8B8B94] focus:outline-none border-0 outline-none ring-0 p-0"
                />
                <button onClick={handleTextSubmit} className={`${primaryButton} shrink-0`}>
                  Continue
                </button>
              </div>
            ) : (
              <div className="w-full rounded-2xl bg-[#141418] border border-[#2E2E35] hover:border-[#3F3F48] focus-within:border-[#8B5CF6] transition-colors p-4 text-left">
                <textarea
                  ref={textareaRef}
                  rows={3}
                  aria-label={currentStep.heading}
                  value={questionVal}
                  onChange={(e) => {
                    setQuestionVal(e.target.value);
                    if (questionError) setQuestionError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleTextSubmit();
                    }
                  }}
                  placeholder={currentStep.placeholder}
                  className="w-full bg-transparent text-[16px] text-[#F4F4F5] placeholder:text-[#8B8B94] focus:outline-none border-0 outline-none ring-0 p-0 resize-none leading-relaxed"
                />
                <p className="pt-2 text-[13px] text-[#8B8B94]">Press ⌘ + Enter to continue</p>
              </div>
            )}

            {questionError && errorLine(undefined, questionError)}

            {currentStep.inputType === "textarea" && (
              <div className="flex items-center gap-4 mt-5 justify-end">
                {currentStep.optional && (
                  <button onClick={handleSkip} className="link-quiet text-[15px] text-[#B4B4BC] hover:text-white cursor-pointer">
                    {currentStep.skipLabel || "Skip"}
                  </button>
                )}
                <button onClick={handleTextSubmit} className={primaryButton}>
                  Continue
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* SINGLE-SELECT STEPS: React Bits JellyRadio, the chosen chip swells and nudges its neighbours */}
      {isSingleSelectStep && (
        <motion.div key={`step-${currentStep.key}`} {...stepMotion} className="w-full">
          {stepHeading(currentStep.heading)}
          {stepSubtext(currentStep.subtext)}
          <div className="w-full max-w-xl">
            <JellyRadio
              items={SINGLE_SELECT_OPTIONS[currentStep.key] || []}
              value={currentSingleVal}
              onChange={(v) => handleSingleSelect(v)}
              ariaLabel={currentStep.heading}
              size="lg"
              gap={10}
              radius={999}
              swell={0.1}
              barge={4}
              chipColor="#1C1C21"
              activeColor="#8B5CF6"
              textColor="#E4E4E7"
              activeTextColor="#FFFFFF"
              className="flex-wrap !px-0"
            />
          </div>
          {questionError && errorLine(undefined, questionError)}
        </motion.div>
      )}

      {/* MULTI-SELECT STEPS: React Bits SpringCheck rows, a spring fills the box and draws the tick */}
      {isMultiSelectStep && (
        <motion.div key={`step-${currentStep.key}`} {...stepMotion} className="w-full">
          {stepHeading(currentStep.heading)}
          {stepSubtext(currentStep.subtext)}
          <div className="w-full max-w-lg grid sm:grid-cols-2 gap-2" role="group" aria-label={currentStep.heading}>
            {(MULTI_SELECT_OPTIONS[currentStep.key] || []).map((option) => {
              const isSelected = getMultiSelectValue().includes(option);
              return (
                <SpringCheck
                  key={option}
                  label={option}
                  checked={isSelected}
                  onChange={() => toggleMultiSelect(option)}
                  strike="none"
                  doneOpacity={1}
                  boxSize={20}
                  boxRadius={6}
                  fontSize={16}
                  color="#F4F4F5"
                  fillColor="#8B5CF6"
                  checkColor="#FFFFFF"
                  className={`w-full px-4 rounded-xl transition-colors ${isSelected ? "bg-[#8B5CF6]/15" : "bg-[#141418] hover:bg-[#1C1C21]"}`}
                />
              );
            })}
          </div>
          {questionError && errorLine(undefined, questionError)}
          <div className="mt-6">
            <button onClick={handleMultiSelectSubmit} className={primaryButton}>
              Continue
            </button>
          </div>
        </motion.div>
      )}

      {/* REVIEW STEP: React Bits SlideCommit, slide to start the research (it runs paid searches, so it asks for intent) */}
      {isReviewStep && (
        <motion.div key="step-review" {...stepMotion} className="w-full">
          {stepHeading("Here's what we have so far.")}
          {stepSubtext("Check your answers, or edit any of them before the research starts.")}

          <div className="w-full max-w-lg space-y-1.5 mb-8 max-h-[380px] overflow-y-auto pr-1 text-left">
            {STEPS.slice(0, -1).map((step, idx) => {
              const fieldKey = step.field;
              if (!fieldKey) return null;
              const raw = data[fieldKey];
              const val = Array.isArray(raw) ? raw.join(", ") : raw;
              return (
                <div key={step.key} className="px-4 py-3 rounded-xl bg-[#141418] border border-[#27272A] flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-[#8B8B94] truncate">{step.heading}</p>
                    <p className="text-[15px] text-[#F4F4F5] truncate">{val || <span className="text-[#8B8B94]">Not answered</span>}</p>
                  </div>
                  <button onClick={() => goToStep(idx)} className="link-quiet text-[14px] text-[#B4B4BC] hover:text-white px-2 py-1 cursor-pointer">
                    Edit
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 items-start">
            <SlideCommit
              label="Slide to start the research"
              doneLabel="Research started"
              errorLabel="Couldn't start it"
              onConfirm={startResearch}
              onDone={openStartedAnalysis}
              width={340}
              height={56}
              radius={999}
              holdMs={600}
              trackColor="#1C1C21"
              handleColor="#F4F4F5"
              successColor="#8B5CF6"
              dangerColor="#F87171"
            />
            {submitError && errorLine(undefined, submitError)}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const backRow = canGoPrev && (
    <div className="flex items-center justify-between mb-8 w-full max-w-lg">
      <button
        onClick={goPrev}
        className="link-quiet text-[15px] text-[#B4B4BC] hover:text-white flex items-center gap-1.5 cursor-pointer"
      >
        <span aria-hidden="true">&larr;</span>
        <span>Back</span>
      </button>
      <p className="text-[14px] text-[#B4B4BC] tabular-nums">
        {currentStep.key === "review" ? "Review your answers" : `Question ${questionNumber} of ${STEPS.length - 1}`}
      </p>
    </div>
  );

  return (
    <section id="hero-section" className="relative bg-[#09090B] text-text-primary min-h-[calc(100vh-3.5rem)]">
      <div className="mx-auto max-w-[1148px] px-4 sm:px-6 pt-10 sm:pt-14 pb-16 sm:pb-24 grid lg:grid-cols-12 gap-x-8 gap-y-12 items-start">
        {/* Left: each question in turn */}
        <div className="lg:col-span-5 min-w-0">
          {backRow}
          {steps}
        </div>
        {/* Right: the visitor's own brief, filling in as they answer */}
        <div className="lg:col-span-7 min-w-0">
          <BriefPanel data={data} currentKey={currentStep.key} />
        </div>
      </div>
    </section>
  );
}
