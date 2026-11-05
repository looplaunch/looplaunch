"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import RubberSegment from "@/components/reactbits/RubberSegment";
import { Avatar } from "@/components/auth/Avatar";
import { SettingsSection } from "@/components/profile/SettingsSection";
import { FIELD, LABEL, PRIMARY_INLINE } from "@/components/ui/fields";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { toast } from "@/lib/toast";
import { AVATAR_COLORS, initialsOf, type ProfileInfo } from "@/lib/auth/profile";

const INPUT = `${FIELD} pr-3.5`;

type Note = { ok: boolean; text: string } | null;

export function ProfileForm({ profile }: { profile: ProfileInfo }) {
  const router = useRouter();

  const [name, setName] = useState(profile.name);
  const [jobTitle, setJobTitle] = useState(profile.jobTitle);
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [website, setWebsite] = useState(profile.companyWebsite.replace(/^https?:\/\//i, ""));
  const [color, setColor] = useState(profile.avatarColor);
  const [usePhoto, setUsePhoto] = useState(Boolean(profile.avatarUrl));
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const preview = {
    initials: initialsOf(name || profile.email),
    avatarColor: color,
    avatarUrl: usePhoto ? profile.googlePhotoUrl : undefined,
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNote(null);
    const site = website.trim();
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({
      data: {
        display_name: name.trim(),
        job_title: jobTitle.trim(),
        company_name: companyName.trim(),
        company_website: site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : "",
        avatar_color: color,
        avatar_mode: usePhoto ? "photo" : "initials",
      },
    });
    if (!error) {
      // Pages read the profile from the login token: a fresh token carries the new details.
      await supabase.auth.refreshSession();
    }
    setSaving(false);
    if (error) {
      setNote({ ok: false, text: error.message });
      return;
    }
    setNote({ ok: true, text: "Saved." });
    toast("Profile saved", { description: "Your name, business and picture are up to date." });
    router.refresh();
  };

  return (
    <form onSubmit={save}>
      <SettingsSection
        id="settings-profile"
        title="Profile"
        description="How you appear in Loop Launch, and the business we fill in when you start an analysis."
      >
        <div className="flex items-center gap-4">
          <Avatar profile={preview} size={64} />
          <div className="space-y-3">
            {profile.googlePhotoUrl && (
              <RubberSegment
                items={[
                  { value: "photo", label: "Google photo" },
                  { value: "initials", label: "Initials" },
                ]}
                value={usePhoto ? "photo" : "initials"}
                onChange={(v) => setUsePhoto(v === "photo")}
                aria-label="Avatar"
                size="sm"
                radius={999}
                trackColor="#09090B"
                thumbColor="#2A2A30"
                textColor="#B4B4BC"
                activeTextColor="#F4F4F5"
              />
            )}
            {!usePhoto && (
              <div className="flex items-center gap-2.5" role="radiogroup" aria-label="Avatar colour">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={`Colour ${c}`}
                    onClick={() => setColor(c)}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition cursor-pointer"
                    style={{ background: c, boxShadow: color === c ? `0 0 0 2px #111114, 0 0 0 4px ${c}` : undefined }}
                  >
                    {color === c && <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-name" className={LABEL}>
              Name
            </label>
            <input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} maxLength={60} />
          </div>
          <div>
            <label htmlFor="pf-role" className={LABEL}>
              What you do
            </label>
            <input
              id="pf-role"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Founder, marketer, agency…"
              className={INPUT}
              maxLength={60}
            />
          </div>
        </div>

        <h3 className="mt-8 text-[14px] font-medium text-[#F4F4F5]">Your business</h3>
        <p className="mt-1 text-[14px] text-[#B4B4BC]">We fill in your website when you start a new analysis.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pf-company" className={LABEL}>
              Company name
            </label>
            <input id="pf-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={INPUT} maxLength={80} />
          </div>
          <div>
            <label htmlFor="pf-site" className={LABEL}>
              Website
            </label>
            <input
              id="pf-site"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="yourcompany.com"
              className={INPUT}
              maxLength={120}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {note && (
            <span key={note.text} role={note.ok ? "status" : "alert"} className={`ll-swap text-[13px] ${note.ok ? "text-[#34D399]" : "text-[#F87171]"}`}>
              {note.text}
            </span>
          )}
          <button type="submit" disabled={saving} className={PRIMARY_INLINE}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </SettingsSection>
    </form>
  );
}
