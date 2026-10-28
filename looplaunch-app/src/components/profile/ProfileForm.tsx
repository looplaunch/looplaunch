"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Avatar } from "@/components/auth/Avatar";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { AVATAR_COLORS, initialsOf, type ProfileInfo } from "@/lib/auth/profile";

const CARD = "rounded-2xl border border-[#27272A] bg-[#111114] p-5 sm:p-6";
const LABEL = "block text-[13px] font-medium text-[#D4D4D8] mb-1.5";
const INPUT =
  "w-full rounded-lg bg-[#09090B] border border-[#27272A] px-3.5 py-2.5 text-sm text-[#F4F4F5] placeholder:text-[#52525B] focus:outline-none focus:border-[#8B5CF6] transition-colors";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#F4F4F5] text-[#09090B] text-sm font-medium hover:bg-white disabled:opacity-40 transition-colors cursor-pointer";

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

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNote, setPwNote] = useState<Note>(null);

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
    const { error } = await createSupabaseBrowserClient().auth.updateUser({
      data: {
        display_name: name.trim(),
        job_title: jobTitle.trim(),
        company_name: companyName.trim(),
        company_website: site ? (/^https?:\/\//i.test(site) ? site : `https://${site}`) : "",
        avatar_color: color,
        avatar_mode: usePhoto ? "photo" : "initials",
      },
    });
    setSaving(false);
    if (error) {
      setNote({ ok: false, text: error.message });
      return;
    }
    setNote({ ok: true, text: "Saved." });
    router.refresh();
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwNote(null);
    if (password.length < 6) {
      setPwNote({ ok: false, text: "Use at least 6 characters." });
      return;
    }
    if (password !== confirm) {
      setPwNote({ ok: false, text: "The two passwords don't match." });
      return;
    }
    setPwBusy(true);
    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });
    setPwBusy(false);
    if (error) {
      setPwNote({ ok: false, text: error.message });
      return;
    }
    setPassword("");
    setConfirm("");
    setPwNote({ ok: true, text: "Password changed." });
  };

  const signOut = async () => {
    await createSupabaseBrowserClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="space-y-5">
        <section className={CARD}>
          <h2 className="text-[15px] font-semibold mb-4">You</h2>

          <div className="flex items-center gap-4 mb-5">
            <Avatar profile={preview} size={64} />
            <div className="space-y-2">
              {profile.googlePhotoUrl && (
                <div className="flex gap-1 p-1 rounded-lg bg-[#09090B] border border-[#27272A] w-fit">
                  {[
                    { photo: true, label: "Google photo" },
                    { photo: false, label: "Initials" },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => setUsePhoto(o.photo)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                        usePhoto === o.photo ? "bg-[#27272A] text-[#F4F4F5]" : "text-[#A1A1AA] hover:text-[#F4F4F5]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              {!usePhoto && (
                <div className="flex items-center gap-2" role="radiogroup" aria-label="Avatar color">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={`Color ${c}`}
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full flex items-center justify-center ring-offset-2 ring-offset-[#111114] transition cursor-pointer"
                      style={{ background: c, boxShadow: color === c ? `0 0 0 2px #111114, 0 0 0 4px ${c}` : undefined }}
                    >
                      {color === c && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
          <p className="text-[12px] text-[#71717A] mt-4">Signed in as {profile.email}</p>
        </section>

        <section className={CARD}>
          <h2 className="text-[15px] font-semibold">Your business</h2>
          <p className="text-[13px] text-[#A1A1AA] mt-1 mb-4">We fill in your website when you start a new analysis.</p>
          <div className="grid gap-4 sm:grid-cols-2">
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
        </section>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className={PRIMARY}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {note && <span className={`text-sm ${note.ok ? "text-[#34D399]" : "text-[#F87171]"}`}>{note.text}</span>}
        </div>
      </form>

      <section className={CARD}>
        <h2 className="text-[15px] font-semibold">Password</h2>
        {profile.usesPassword ? (
          <form onSubmit={changePassword} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pf-pw" className={LABEL}>
                  New password
                </label>
                <input
                  id="pf-pw"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor="pf-pw2" className={LABEL}>
                  Type it again
                </label>
                <input
                  id="pf-pw2"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={pwBusy || !password} className={PRIMARY}>
                {pwBusy ? "Changing…" : "Change password"}
              </button>
              {pwNote && <span className={`text-sm ${pwNote.ok ? "text-[#34D399]" : "text-[#F87171]"}`}>{pwNote.text}</span>}
            </div>
          </form>
        ) : (
          <p className="text-[13px] text-[#A1A1AA] mt-1">You sign in with Google, so there&apos;s no password to change here.</p>
        )}
      </section>

      <section className={`${CARD} flex items-center justify-between gap-4`}>
        <div>
          <h2 className="text-[15px] font-semibold">Sign out</h2>
          <p className="text-[13px] text-[#A1A1AA] mt-0.5">Your analyses stay saved in your account.</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="px-4 py-2.5 rounded-lg border border-[#3F3F46] text-sm font-medium text-[#F4F4F5] hover:bg-[#17171B] transition-colors cursor-pointer"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}
