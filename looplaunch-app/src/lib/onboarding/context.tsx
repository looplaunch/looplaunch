"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  type OnboardingData,
  EMPTY_ONBOARDING,
  STEPS,
} from "./types";

const STORAGE_KEY = "looplaunch-onboarding";
const RESET_EVENT = "looplaunch:onboarding-reset";

/**
 * Forget saved answers so the next analysis starts at question 1.
 * A mounted onboarding flow resets right away; one that mounts later starts empty.
 */
export function clearOnboardingProgress() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable
  }
  window.dispatchEvent(new Event(RESET_EVENT));
}

interface OnboardingContextValue {
  data: OnboardingData;
  currentStepIndex: number;
  currentStep: (typeof STEPS)[number];
  totalSteps: number;
  updateField: (field: keyof OnboardingData, value: string | string[]) => void;
  goNext: () => void;
  goPrev: () => void;
  goToStep: (index: number) => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  isComplete: boolean;
  reset: () => void;
  /** Drop the saved answers once an analysis has launched, so coming back starts fresh. */
  clearSaved: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

interface OnboardingProviderProps {
  children: ReactNode;
  /** Answers to start with when nothing is saved, e.g. the website from the user's profile */
  initialData?: Partial<OnboardingData>;
}

export function OnboardingProvider({ children, initialData }: OnboardingProviderProps) {
  const [data, setData] = useState<OnboardingData>(() => ({ ...EMPTY_ONBOARDING, ...initialData }));
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const skipPersist = useRef(false);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.data) setData(parsed.data);
        if (typeof parsed.step === "number") setCurrentStepIndex(parsed.step);
      }
    } catch {
      // Ignore parse errors
    }
    setHydrated(true);
  }, []);

  // "Start a new analysis" from anywhere in the app
  useEffect(() => {
    const onReset = () => {
      skipPersist.current = false;
      setData({ ...EMPTY_ONBOARDING, ...initialData });
      setCurrentStepIndex(0);
    };
    window.addEventListener(RESET_EVENT, onReset);
    return () => window.removeEventListener(RESET_EVENT, onReset);
  }, [initialData]);

  // Persist to sessionStorage on change
  useEffect(() => {
    if (!hydrated || skipPersist.current) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ data, step: currentStepIndex })
      );
    } catch {
      // Storage full or unavailable
    }
  }, [data, currentStepIndex, hydrated]);

  const currentStep = STEPS[currentStepIndex];
  const totalSteps = STEPS.length;

  const updateField = useCallback(
    (field: keyof OnboardingData, value: string | string[]) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const goNext = useCallback(() => {
    setCurrentStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const goPrev = useCallback(() => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const goToStep = useCallback((index: number) => {
    setCurrentStepIndex(Math.max(0, Math.min(index, STEPS.length - 1)));
  }, []);

  const reset = useCallback(() => {
    setData(EMPTY_ONBOARDING);
    setCurrentStepIndex(0);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const clearSaved = useCallback(() => {
    skipPersist.current = true;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
  }, []);

  const canGoNext = currentStepIndex < STEPS.length - 1;
  const canGoPrev = currentStepIndex > 0;
  const isComplete = currentStepIndex === STEPS.length - 1;

  return (
    <OnboardingContext.Provider
      value={{
        data,
        currentStepIndex,
        currentStep,
        totalSteps,
        updateField,
        goNext,
        goPrev,
        goToStep,
        canGoNext,
        canGoPrev,
        isComplete,
        reset,
        clearSaved,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
