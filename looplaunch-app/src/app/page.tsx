import { Dashboard } from "@/components/dashboard/Dashboard";
import { WaitlistLandingPage } from "@/components/landing/LandingPage";
import { OnboardingProvider } from "@/lib/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { canUseApp, isWaitlistOn } from "@/lib/auth/team";
import { profileOf } from "@/lib/auth/profile";
import { listSessionSummaries } from "@/lib/intelligence/store";

/**
 * People who can use the app (src/lib/auth/team.ts) get their dashboard. Everyone else gets
 * the landing page: with the waitlist as its hero while the waitlist is on, otherwise with
 * the onboarding questions. The questions version also lives at /home for the team.
 */
export default async function Home() {
  const user = await getCurrentUser();

  if (user && canUseApp(user.email)) {
    const sessions = await listSessionSummaries(user.id, 7);
    return <Dashboard profile={profileOf(user)} sessions={sessions} />;
  }

  if (isWaitlistOn()) {
    return <WaitlistLandingPage signedInEmail={user?.email} />;
  }

  return (
    <OnboardingProvider>
      <OnboardingShell />
    </OnboardingProvider>
  );
}
