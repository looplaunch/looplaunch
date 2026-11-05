import { Dashboard } from "@/components/dashboard/Dashboard";
import { WaitlistLandingPage } from "@/components/landing/LandingPage";
import { OnboardingProvider } from "@/lib/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Suspense } from "react";
import { getTokenUser, type TokenUser } from "@/lib/auth/supabase-server";
import { AppSkeleton } from "@/components/app/AppSkeleton";
import { canUseApp, isWaitlistOn } from "@/lib/auth/team";
import { profileOf } from "@/lib/auth/profile";
import { listSessionSummaries } from "@/lib/intelligence/store";

const DASHBOARD_LIMIT = 50;

/**
 * People who can use the app (src/lib/auth/team.ts) get their dashboard. Everyone else gets the
 * landing page: with the waitlist as its hero while the waitlist
 * is on, otherwise with the onboarding questions. The waitlist version also lives at /waitlist and
 * the questions version at /home, so the team can see both.
 */
export default async function Home() {
  const user = await getTokenUser();

  if (user && canUseApp(user.email)) {
    // The page's outline shows at once; the analyses stream in when the query answers.
    return (
      <Suspense fallback={<AppSkeleton rows={3} aside active="home" />}>
        <SignedInDashboard user={user} />
      </Suspense>
    );
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

async function SignedInDashboard({ user }: { user: TokenUser }) {
  // Enough rows for honest counts; the dashboard lists only the first few.
  const sessions = await listSessionSummaries(user.id, DASHBOARD_LIMIT);
  return <Dashboard profile={profileOf(user)} sessions={sessions} truncated={sessions.length === DASHBOARD_LIMIT} />;
}
