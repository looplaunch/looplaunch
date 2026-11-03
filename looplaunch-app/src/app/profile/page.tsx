import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/profile/SettingsView";
import { getCurrentUser } from "@/lib/auth/supabase-server";
import { profileOf } from "@/lib/auth/profile";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");

  return <SettingsView profile={profileOf(user)} pendingEmail={user.new_email} />;
}
