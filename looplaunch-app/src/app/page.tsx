import { OnboardingProvider } from "@/lib/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { profileOf } from "@/lib/auth/profile";
import { listSessionSummaries } from "@/lib/intelligence/store";

/** Signed-in people get their dashboard; everyone else gets the landing page with the questions. */
export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    const sessions = await listSessionSummaries(user.id, 7);
    return <Dashboard profile={profileOf(user)} sessions={sessions} />;
  }

  return (
    <OnboardingProvider>
      <OnboardingShell />
    </OnboardingProvider>
  );
}
