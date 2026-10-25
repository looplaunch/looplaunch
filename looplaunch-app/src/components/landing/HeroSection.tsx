"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import SideRays from "@/components/ui/SideRays";
import { Mascot } from "@/components/onboarding/Mascot";
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

export function HeroSection() {
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
  } = useOnboarding();

  // Intelligence pipeline submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  useEffect(() => {
    if (data.website) {
      setDomainInput(data.website.replace(/^https?:\/\//i, "").trim());
    }
  }, [data.website]);

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

  useEffect(() => {
    if (currentField) {
      const val = data[currentField];
      setQuestionVal(typeof val === "string" ? val : "");
      setQuestionError("");
    }
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
      // Auto-advance on single select
      setTimeout(() => goNext(), 180);
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
  const handleLaunchIntelligence = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const res = await fetch("/api/intelligence/gather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Server error" }));
        setSubmitError(errData.error || "Failed to start intelligence gathering.");
        setIsSubmitting(false);
        return;
      }

      const result = await res.json();
      router.push(`/intelligence?session=${result.sessionId}`);
    } catch {
      setSubmitError("Network error. Please check your connection.");
      setIsSubmitting(false);
    }
  };

  const scrollToExplore = () => {
    const nextSection = document.getElementById("what-is-it");
    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth" });
    }
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

  return (
    <section
      id="hero-section"
      className="relative min-h-[92vh] flex flex-col justify-between items-center px-6 pt-16 pb-12 overflow-hidden bg-black text-text-primary"
    >
      {/* Layer 0: SideRays */}
      <div
        className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <SideRays
          speed={1.0}
          rayColor1="#8B5CF6"
          rayColor2="#18181B"
          intensity={0.4}
          spread={1.5}
          origin="top-right"
          tilt={0}
          saturation={0.8}
          blend={0.5}
          falloff={2.2}
          opacity={0.35}
        />
      </div>

      {/* Layer 1: Vignette */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-[#09090B]/60 via-transparent to-[#09090B]"
        aria-hidden="true"
      />

      {/* Layer 2: Content */}
      <div className="relative z-[2] w-full max-w-xl mx-auto flex flex-col items-center text-center my-auto py-10">
        {/* Mascot */}
        <div className="mb-6">
          <Mascot size={isReviewStep ? 52 : 64} />
        </div>

        {/* Back + Step Indicator */}
        {canGoPrev && (
          <div className="flex items-center justify-between w-full mb-6 px-1">
            <button
              onClick={goPrev}
              className="text-xs text-text-secondary hover:text-[#8B5CF6] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>&larr;</span>
              <span>Back</span>
            </button>
            <div className="text-xs font-mono text-[#8B5CF6] tracking-wider uppercase font-semibold">
              Step {currentStepIndex + 1} of {STEPS.length - 1}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════ */}
          {/* WEBSITE STEP (Q1 — with https:// prefix + favicon) */}
          {/* ═══════════════════════════════════════════ */}
          {isWebsiteStep && (
            <motion.div
              key="step-website"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex flex-col items-center"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-text-primary mb-3 leading-[1.15]">
                {currentStep.heading}
              </h1>
              <p className="text-text-secondary text-sm sm:text-base max-w-md mb-8 leading-relaxed font-normal">
                {currentStep.subtext}
              </p>

              <div className="w-full max-w-lg mx-auto">
                <div
                  className={`
                    relative flex items-center w-full px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl
                    bg-bg-surface border transition-all duration-200 gap-2
                    ${websiteError
                      ? "border-error ring-1 ring-error/30"
                      : websiteFocused
                        ? "border-[#8B5CF6] ring-1 ring-[#8B5CF6]/30"
                        : "border-border-subtle hover:border-[#8B5CF6]/40"
                    }
                  `}
                >
                  {/* Favicon or Globe */}
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {hasValidDomain && !faviconError ? (
                      <img
                        key={cleanDomain}
                        src={`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`}
                        alt=""
                        className="w-4 h-4 rounded-sm object-contain animate-fade-in"
                        onError={() => setFaviconError(true)}
                      />
                    ) : (
                      <svg className="w-4 h-4 text-text-tertiary select-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                      </svg>
                    )}
                  </div>

                  <span className="text-text-tertiary select-none font-mono text-sm sm:text-base tracking-tight shrink-0">
                    https://
                  </span>

                  <input
                    id="hero-website-input"
                    type="text"
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
                    className="flex-1 bg-transparent text-text-primary text-base sm:text-lg placeholder:text-text-placeholder focus:outline-none border-0 outline-none ring-0 p-0"
                  />

                  <button
                    onClick={handleWebsiteSubmit}
                    aria-label="Continue with website"
                    className="ml-1 flex items-center justify-center w-9 h-9 rounded-lg bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:scale-95 transition-all duration-200 cursor-pointer shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>

                {websiteError && (
                  <p className="mt-2.5 text-xs sm:text-sm text-error text-left pl-2 animate-fade-in-up">
                    {websiteError}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* TEXT / TEXTAREA STEPS (e.g. Q5: core offer) */}
          {/* ═══════════════════════════════════════════ */}
          {isTextStep && (
            <motion.div
              key={`step-${currentStep.key}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex flex-col items-center"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-text-primary mb-3 leading-[1.15]">
                {currentStep.heading}
              </h1>
              <p className="text-text-secondary text-sm sm:text-base max-w-lg mb-8 leading-relaxed font-normal">
                {currentStep.subtext}
              </p>

              <div className="w-full max-w-lg mx-auto">
                {currentStep.inputType === "text" ? (
                  /* Single-line text input */
                  <div
                    className={`
                      relative flex items-center w-full px-4 py-2.5 rounded-xl
                      bg-bg-surface border transition-all duration-200
                      border-border-subtle hover:border-[#8B5CF6]/40
                      focus-within:border-[#8B5CF6] focus-within:ring-1 focus-within:ring-[#8B5CF6]/30
                    `}
                  >
                    <input
                      ref={inputRef}
                      type="text"
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
                      className="flex-1 bg-transparent text-text-primary text-base sm:text-lg placeholder:text-text-placeholder focus:outline-none border-0 outline-none ring-0 p-0"
                    />
                    <button
                      onClick={handleTextSubmit}
                      aria-label="Continue"
                      className="ml-2 flex items-center justify-center w-9 h-9 rounded-lg bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  /* Textarea input */
                  <div className="relative w-full rounded-xl bg-bg-surface border border-border-subtle hover:border-[#8B5CF6]/40 focus-within:border-[#8B5CF6] focus-within:ring-1 focus-within:ring-[#8B5CF6]/30 transition-all p-3 sm:p-4 text-left">
                    <textarea
                      ref={textareaRef}
                      rows={3}
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
                      className="w-full bg-transparent text-text-primary text-sm sm:text-base placeholder:text-text-placeholder focus:outline-none border-0 outline-none ring-0 p-0 resize-none leading-relaxed"
                    />
                    <div className="flex justify-between items-center pt-2 text-[11px] text-text-tertiary">
                      <span>Press ⌘+Enter to continue</span>
                    </div>
                  </div>
                )}

                {questionError && (
                  <p className="mt-2.5 text-xs sm:text-sm text-error text-left pl-2 animate-fade-in-up">
                    {questionError}
                  </p>
                )}

                {/* Actions for textarea steps */}
                {currentStep.inputType === "textarea" && (
                  <div className="flex items-center justify-end gap-3 mt-5">
                    {currentStep.optional && (
                      <button
                        onClick={handleSkip}
                        className="px-4 py-2 rounded-lg text-xs sm:text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                      >
                        {currentStep.skipLabel || "Skip"}
                      </button>
                    )}
                    <button
                      onClick={handleTextSubmit}
                      className="px-5 py-2.5 rounded-lg text-xs sm:text-sm font-medium bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Continue</span>
                      <span>&rarr;</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* SINGLE-SELECT STEPS (role, industry, stage, headache, 30-day goal) */}
          {/* ═══════════════════════════════════════════ */}
          {isSingleSelectStep && (
            <motion.div
              key={`step-${currentStep.key}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex flex-col items-center"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-text-primary mb-3 leading-[1.15]">
                {currentStep.heading}
              </h1>
              <p className="text-text-secondary text-sm sm:text-base max-w-lg mb-8 leading-relaxed font-normal">
                {currentStep.subtext}
              </p>

              <div className="w-full max-w-lg mx-auto space-y-2.5">
                {(SINGLE_SELECT_OPTIONS[currentStep.key] || []).map((option) => {
                  const isSelected = currentSingleVal === option;
                  return (
                    <button
                      key={option}
                      onClick={() => handleSingleSelect(option)}
                      className={`
                        w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer
                        flex items-center gap-3 group
                        ${isSelected
                          ? "border-[#8B5CF6] bg-[#8B5CF6]/10"
                          : "border-border-subtle bg-bg-surface hover:border-[#8B5CF6]/40 hover:bg-bg-elevated"
                        }
                      `}
                    >
                      {/* Radio indicator */}
                      <div
                        className={`
                          w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all
                          ${isSelected
                            ? "border-[#8B5CF6] bg-[#8B5CF6]"
                            : "border-border-subtle group-hover:border-[#8B5CF6]/50"
                          }
                        `}
                      >
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className={`text-sm sm:text-base ${isSelected ? "text-text-primary" : "text-text-secondary"}`}>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>

              {questionError && (
                <p className="mt-3 text-xs sm:text-sm text-error animate-fade-in-up">
                  {questionError}
                </p>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* MULTI-SELECT STEPS (audience, sales channels) */}
          {/* ═══════════════════════════════════════════ */}
          {isMultiSelectStep && (
            <motion.div
              key={`step-${currentStep.key}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex flex-col items-center"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-text-primary mb-3 leading-[1.15]">
                {currentStep.heading}
              </h1>
              <p className="text-text-secondary text-sm sm:text-base max-w-lg mb-8 leading-relaxed font-normal">
                {currentStep.subtext}
              </p>

              <div className="w-full max-w-lg mx-auto space-y-2.5">
                {(MULTI_SELECT_OPTIONS[currentStep.key] || []).map((option) => {
                  const isSelected = getMultiSelectValue().includes(option);
                  return (
                    <button
                      key={option}
                      onClick={() => toggleMultiSelect(option)}
                      className={`
                        w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer
                        flex items-center gap-3 group
                        ${isSelected
                          ? "border-[#8B5CF6] bg-[#8B5CF6]/10"
                          : "border-border-subtle bg-bg-surface hover:border-[#8B5CF6]/40 hover:bg-bg-elevated"
                        }
                      `}
                    >
                      {/* Checkbox indicator */}
                      <div
                        className={`
                          w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                          ${isSelected
                            ? "border-[#8B5CF6] bg-[#8B5CF6]"
                            : "border-border-subtle group-hover:border-[#8B5CF6]/50"
                          }
                        `}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm sm:text-base ${isSelected ? "text-text-primary" : "text-text-secondary"}`}>
                        {option}
                      </span>
                    </button>
                  );
                })}
              </div>

              {questionError && (
                <p className="mt-3 text-xs sm:text-sm text-error animate-fade-in-up">
                  {questionError}
                </p>
              )}

              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={handleMultiSelectSubmit}
                  className="px-6 py-2.5 rounded-xl text-sm font-medium bg-[#8B5CF6] text-white hover:bg-[#7C3AED] active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>Continue</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* REVIEW STEP */}
          {/* ═══════════════════════════════════════════ */}
          {isReviewStep && (
            <motion.div
              key="step-review"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex flex-col items-center"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-normal tracking-tight text-text-primary mb-3 leading-[1.15]">
                Here&apos;s what we have so far.
              </h1>
              <p className="text-text-secondary text-sm sm:text-base max-w-lg mb-8 leading-relaxed font-normal">
                Review your answers below or jump to any section to edit.
              </p>

              {/* Answers Grid */}
              <div className="w-full max-w-lg mx-auto space-y-2 text-left mb-8 max-h-[360px] overflow-y-auto pr-1">
                {STEPS.slice(0, -1).map((step, idx) => {
                  const fieldKey = step.field;
                  if (!fieldKey) return null;
                  const raw = data[fieldKey];
                  const val = Array.isArray(raw) ? raw.join(", ") : raw;
                  return (
                    <div
                      key={step.key}
                      className="p-3.5 rounded-xl bg-bg-surface border border-border-subtle flex items-start justify-between gap-3 hover:border-[#8B5CF6]/40 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase tracking-wider text-[#8B5CF6] font-semibold mb-0.5">
                          {step.heading}
                        </div>
                        <div className="text-xs sm:text-sm text-text-primary truncate">
                          {val || <span className="text-text-tertiary">Not provided</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => goToStep(idx)}
                        className="text-xs text-text-tertiary hover:text-white px-2 py-1 rounded bg-bg-elevated hover:bg-[#8B5CF6]/20 transition-all cursor-pointer"
                      >
                        Edit
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Launch Intelligence Pipeline */}
              {submitError && (
                <p className="text-xs sm:text-sm text-error text-center mb-3 animate-fade-in-up">
                  {submitError}
                </p>
              )}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-lg justify-center">
                <button
                  onClick={handleLaunchIntelligence}
                  disabled={isSubmitting}
                  className="
                    w-full sm:w-auto px-7 py-3 rounded-xl font-medium text-sm sm:text-base
                    bg-[#8B5CF6] text-white hover:bg-[#7C3AED] border border-[#8B5CF6]/40
                    active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Starting analysis...</span>
                    </>
                  ) : (
                    <>
                      <span>Launch Intelligence</span>
                      <span>&rarr;</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Subtle scroll indicator */}
      <div className="relative z-[2] w-full flex justify-center mt-auto pt-4">
        <button
          onClick={scrollToExplore}
          className="text-text-tertiary hover:text-text-secondary text-xs tracking-wider transition-colors cursor-pointer flex items-center gap-1.5 focus:outline-none"
        >
          <span>Scroll</span>
          <span>&darr;</span>
        </button>
      </div>
    </section>
  );
}
