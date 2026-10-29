"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

const CARD = "rounded-2xl border border-[#27272A] bg-[#111114] p-5 sm:p-6";
const INPUT =
  "w-full rounded-lg bg-[#09090B] border border-[#27272A] px-3.5 py-2.5 text-sm text-[#F4F4F5] placeholder:text-[#52525B] focus:outline-none focus:border-[#8B5CF6] transition-colors";
const PRIMARY =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#F4F4F5] text-[#09090B] text-sm font-medium hover:bg-white disabled:opacity-40 transition-colors cursor-pointer";
const SECONDARY =
  "px-3.5 py-2 rounded-lg border border-[#3F3F46] text-[13px] font-medium text-[#F4F4F5] hover:bg-[#17171B] disabled:opacity-40 transition-colors cursor-pointer";
const LINK = "text-[12px] text-[#A1A1AA] hover:text-[#F4F4F5] cursor-pointer";

type Note = { ok: boolean; text: string } | null;

interface AccountSettingsProps {
  email: string;
  /** An email change that's waiting to be confirmed */
  pendingEmail?: string;
  usesPassword: boolean;
  usesGoogle: boolean;
}

function Message({ note }: { note: Note }) {
  if (!note) return null;
  return <p className={`text-[13px] leading-relaxed ${note.ok ? "text-[#34D399]" : "text-[#F87171]"}`}>{note.text}</p>;
}

function Row({ label, value, action, children }: { label: string; value: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#D4D4D8]">{label}</p>
          <div className="text-[13px] text-[#A1A1AA] mt-0.5 break-words">{value}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Settings → how you sign in (email, password, Google), logging out, and deleting the account. */
export function AccountSettings({ email, pendingEmail, usesPassword, usesGoogle }: AccountSettingsProps) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <section className={CARD}>
        <h2 className="text-[15px] font-semibold mb-4">Sign-in &amp; security</h2>
        <div className="divide-y divide-[#27272A]">
          <EmailRow email={email} pendingEmail={pendingEmail} onChanged={() => router.refresh()} />
          <PasswordRow email={email} usesPassword={usesPassword} onChanged={() => router.refresh()} />
          <Row
            label="Google"
            value={
              usesGoogle
                ? "Connected. You can log in with Continue with Google."
                : "Not used yet. Continue with Google also works if your Google account uses this email."
            }
          />
        </div>
      </section>

      <SignOutCard />
      <DeleteAccountCard />
    </div>
  );
}

// ─── Email ───

type EmailStage = "closed" | "enter" | "new-code" | "current-code";

function EmailRow({ email, pendingEmail, onChanged }: { email: string; pendingEmail?: string; onChanged: () => void }) {
  const [stage, setStage] = useState<EmailStage>("closed");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const reset = (next: EmailStage) => {
    setStage(next);
    setCode("");
    setNote(null);
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = newEmail.trim().toLowerCase();
    if (target === email.toLowerCase()) {
      setNote({ ok: false, text: "That's already your email." });
      return;
    }
    setBusy(true);
    setNote(null);
    // Supabase emails a code (or a link) to the new address, and also to the current one when
    // "secure email change" is on. The change only happens once it's confirmed.
    const { error } = await createSupabaseBrowserClient().auth.updateUser(
      { email: target },
      { emailRedirectTo: `${window.location.origin}/profile` }
    );
    setBusy(false);
    if (error) {
      const taken = /already (been )?registered|already exists/i.test(error.message);
      setNote({
        ok: false,
        text: taken
          ? "That email already has a Loop Launch account."
          : /rate limit|seconds/i.test(error.message)
            ? "Please wait a minute before asking for another code."
            : error.message,
      });
      return;
    }
    setNewEmail(target);
    reset("new-code");
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const address = stage === "new-code" ? newEmail : email;
    const { data, error } = await createSupabaseBrowserClient().auth.verifyOtp({
      email: address,
      token: code.trim(),
      type: "email_change",
    });
    setBusy(false);
    if (error) {
      setNote({ ok: false, text: `That code didn't work. Make sure it's the one sent to ${address}.` });
      return;
    }
    if (!data.session) {
      // Secure email change: the first code is accepted, the other address still has to confirm.
      reset(stage === "new-code" ? "current-code" : "new-code");
      return;
    }
    reset("closed");
    setNote({ ok: true, text: `Your email is now ${newEmail}.` });
    onChanged();
  };

  const codeFor = stage === "new-code" ? newEmail : email;

  return (
    <Row
      label="Email"
      value={
        <>
          {email}
          {pendingEmail && stage === "closed" && (
            <span className="block text-[12px] text-[#FBBF24] mt-1">
              Waiting for you to confirm the change to {pendingEmail}. Check both inboxes.
            </span>
          )}
        </>
      }
      action={
        stage === "closed" && (
          <button type="button" onClick={() => reset("enter")} className={SECONDARY}>
            Change
          </button>
        )
      }
    >
      {stage === "enter" && (
        <form onSubmit={sendCode} className="mt-4 space-y-3">
          <label htmlFor="acc-new-email" className="block text-[12px] text-[#A1A1AA]">
            New email
          </label>
          <input
            id="acc-new-email"
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className={INPUT}
          />
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className={PRIMARY}>
              {busy ? "Sending…" : "Send code"}
            </button>
            <button type="button" onClick={() => reset("closed")} className={LINK}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {(stage === "new-code" || stage === "current-code") && (
        <form onSubmit={confirm} className="mt-4 space-y-3">
          <p className="text-[13px] text-[#D4D4D8] leading-relaxed">
            {stage === "new-code" ? (
              <>Enter the 6-digit code we sent to <span className="font-medium text-[#F4F4F5]">{codeFor}</span>.</>
            ) : (
              <>
                One more step: enter the code we sent to your current email,{" "}
                <span className="font-medium text-[#F4F4F5]">{codeFor}</span>.
              </>
            )}
          </p>
          <div className="max-w-xs">
            <OtpInput key={stage} value={code} onChange={setCode} disabled={busy} autoFocus />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || code.length !== 6} className={PRIMARY}>
              {busy ? "Checking…" : "Confirm"}
            </button>
            <button type="button" onClick={() => sendCode()} disabled={busy} className={LINK}>
              Send new codes
            </button>
            <button type="button" onClick={() => reset("closed")} className={LINK}>
              Cancel
            </button>
          </div>
          <p className="text-[12px] text-[#71717A]">Got a link instead of a code? Click it, and your email changes once it&apos;s confirmed.</p>
        </form>
      )}

      {note && <div className="mt-3"><Message note={note} /></div>}
    </Row>
  );
}

// ─── Password ───

function PasswordRow({ email, usesPassword, onChanged }: { email: string; usesPassword: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  // Supabase can be set to require a fresh code before a password change ("secure password change").
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const close = () => {
    setOpen(false);
    setCurrent("");
    setPassword("");
    setNeedsCode(false);
    setCode("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setNote(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();

    if (usesPassword && !needsCode) {
      // Check the current password first, so an unattended open laptop can't change it.
      const { error } = await supabase.auth.signInWithPassword({ email, password: current });
      if (error) {
        setBusy(false);
        setNote({ ok: false, text: "Your current password is wrong." });
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({
      password,
      data: { has_password: true },
      ...(needsCode ? { nonce: code.trim() } : {}),
    });

    if (error && !needsCode && (error.code === "reauthentication_needed" || /reauthenticat/i.test(error.message))) {
      const { error: sendError } = await supabase.auth.reauthenticate();
      setBusy(false);
      if (sendError) {
        setNote({ ok: false, text: sendError.message });
        return;
      }
      setNeedsCode(true);
      setNote({ ok: true, text: `For security, we sent a 6-digit code to ${email}. Enter it to finish.` });
      return;
    }

    setBusy(false);
    if (error) {
      setNote({ ok: false, text: needsCode ? "That code didn't work. Check it and try again." : error.message });
      return;
    }
    close();
    setNote({
      ok: true,
      text: usesPassword ? "Password changed." : `Password set. You can now also log in with ${email} and this password.`,
    });
    onChanged();
  };

  return (
    <Row
      label="Password"
      value={usesPassword ? "Set" : "Not set. You log in with Google."}
      action={
        !open && (
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setNote(null);
            }}
            className={SECONDARY}
          >
            {usesPassword ? "Change" : "Set a password"}
          </button>
        )
      }
    >
      {open && (
        <form onSubmit={save} className="mt-4 space-y-3 max-w-sm">
          {needsCode ? (
            <OtpInput value={code} onChange={setCode} disabled={busy} autoFocus />
          ) : (
            <>
              {usesPassword && (
                <div>
                  <label htmlFor="acc-current-pw" className="block text-[12px] text-[#A1A1AA] mb-1.5">
                    Current password
                  </label>
                  <PasswordInput
                    id="acc-current-pw"
                    required
                    autoFocus
                    autoComplete="current-password"
                    value={current}
                    onChange={setCurrent}
                  />
                </div>
              )}
              <div>
                <label htmlFor="acc-new-pw" className="block text-[12px] text-[#A1A1AA] mb-1.5">
                  New password (6+ characters)
                </label>
                <PasswordInput
                  id="acc-new-pw"
                  required
                  minLength={6}
                  autoFocus={!usesPassword}
                  autoComplete="new-password"
                  value={password}
                  onChange={setPassword}
                />
              </div>
            </>
          )}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busy || password.length < 6 || (needsCode && code.length !== 6)}
              className={PRIMARY}
            >
              {busy ? "Saving…" : usesPassword ? "Change password" : "Set password"}
            </button>
            <button type="button" onClick={close} className={LINK}>
              Cancel
            </button>
          </div>
          {usesPassword && !needsCode && (
            <p className="text-[12px] text-[#71717A]">
              Forgot your current password? Log out and use &ldquo;Forgot password?&rdquo; on the login page.
            </p>
          )}
        </form>
      )}

      {note && <div className="mt-3"><Message note={note} /></div>}
    </Row>
  );
}

// ─── Log out ───

function SignOutCard() {
  const router = useRouter();
  const [busy, setBusy] = useState<"here" | "everywhere" | null>(null);

  const signOut = async (scope: "local" | "global") => {
    setBusy(scope === "local" ? "here" : "everywhere");
    await createSupabaseBrowserClient().auth.signOut({ scope });
    router.push("/");
    router.refresh();
  };

  return (
    <section className={`${CARD} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
      <div>
        <h2 className="text-[15px] font-semibold">Log out</h2>
        <p className="text-[13px] text-[#A1A1AA] mt-0.5">Your analyses stay saved in your account.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => signOut("global")} disabled={busy !== null} className={SECONDARY}>
          {busy === "everywhere" ? "Logging out…" : "Log out of all devices"}
        </button>
        <button type="button" onClick={() => signOut("local")} disabled={busy !== null} className={SECONDARY}>
          {busy === "here" ? "Logging out…" : "Log out"}
        </button>
      </div>
    </section>
  );
}

// ─── Delete account ───

function DeleteAccountCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't delete your account. Please try again.");
      // The account is gone; clear the login this browser still holds.
      await createSupabaseBrowserClient().auth.signOut({ scope: "local" }).catch(() => {});
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete your account. Please try again.");
      setBusy(false);
    }
  };

  return (
    <section className={`${CARD} border-[#7F1D1D]/60`}>
      <h2 className="text-[15px] font-semibold text-[#F87171]">Delete account</h2>
      <p className="text-[13px] text-[#A1A1AA] mt-1 leading-relaxed">
        Permanently deletes your account, every analysis and chat in it, and your profile. This can&apos;t be undone.
      </p>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="mt-4 px-4 py-2.5 rounded-lg border border-[#7F1D1D] text-sm font-medium text-[#F87171] hover:bg-[#7F1D1D]/20 transition-colors cursor-pointer"
      >
        Delete my account
      </button>

      <ConfirmDialog
        open={open}
        title="Delete your account?"
        description="Your account, all your analyses and chats, and your profile will be permanently deleted. You can sign up again later, but none of this can be brought back."
        confirmLabel="Delete account"
        requireText="DELETE"
        busy={busy}
        error={error}
        onConfirm={remove}
        onClose={() => setOpen(false)}
      />
    </section>
  );
}
