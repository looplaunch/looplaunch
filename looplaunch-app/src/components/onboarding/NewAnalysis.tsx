"use client";

import { useMemo } from "react";
import { OnboardingProvider } from "@/lib/onboarding/context";
import { QuestionFlow } from "./QuestionFlow";

/** The 9 questions on their own page, pre-filled with the website saved in the user's profile. */
export function NewAnalysis({ defaultWebsite }: { defaultWebsite?: string }) {
  const initialData = useMemo(() => (defaultWebsite ? { website: defaultWebsite } : undefined), [defaultWebsite]);
  return (
    <OnboardingProvider initialData={initialData}>
      <QuestionFlow />
    </OnboardingProvider>
  );
}
