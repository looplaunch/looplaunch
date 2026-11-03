import { Dashboard } from "@/components/dashboard/Dashboard";
import { OnboardingProvider } from "@/lib/onboarding/context";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { canUseApp } from "@/lib/auth/team";
import { profileOf } from "@/lib/auth/profile";
import { listSessionSummaries } from "@/lib/intelligence/store";

const DASHBOARD_LIMIT = 50;

/**
 * People who can use the app (src/lib/auth/team.ts) get their dashboard. Everyone else gets
 * the original landing page.
 */
export default async function Home() {
  const user = await getCurrentUser();

  if (user && canUseApp(user.email)) {
    // Enough rows for honest counts; the dashboard lists only the first few.
    const sessions = await listSessionSummaries(user.id, DASHBOARD_LIMIT);
    return <Dashboard profile={profileOf(user)} sessions={sessions} truncated={sessions.length === DASHBOARD_LIMIT} />;
  }

  return (
    <OnboardingProvider>
      <OnboardingShell />
    </OnboardingProvider>
  );
}
