import type { Metadata } from "next";
import { OnboardingProvider } from "@/lib/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export const metadata: Metadata = { robots: { index: false } };

/** The original public landing page, kept for the team while "/" shows the waitlist. */
export default function LandingHome() {
  return (
    <OnboardingProvider>
      <OnboardingShell />
    </OnboardingProvider>
  );
}
