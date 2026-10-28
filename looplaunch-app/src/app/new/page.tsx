import { AppNav } from "@/components/app/AppNav";
import { NewAnalysis } from "@/components/onboarding/NewAnalysis";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { profileOf } from "@/lib/auth/profile";

export default async function NewAnalysisPage() {
  const user = await getCurrentUser();
  const profile = user ? profileOf(user) : null;

  return (
    <div className="min-h-screen bg-black">
      <AppNav profile={profile} active="new" />
      <NewAnalysis defaultWebsite={profile?.companyWebsite || undefined} />
    </div>
  );
}
