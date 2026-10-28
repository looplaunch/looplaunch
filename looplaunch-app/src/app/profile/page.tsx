import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/AppNav";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { profileOf } from "@/lib/auth/profile";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  const profile = profileOf(user);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5]">
      <AppNav profile={profile} active="profile" />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Profile settings</h1>
        <p className="text-sm text-[#A1A1AA] mt-1 mb-8">How you appear in Loop Launch, and the details Loopy uses to save you typing.</p>
        <ProfileForm profile={profile} />
      </main>
    </div>
  );
}
