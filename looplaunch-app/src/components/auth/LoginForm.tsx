"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { OtpInput } from "@/components/auth/OtpInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { GoogleIcon } from "@/components/auth/GoogleIcon";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { startGoogleSignIn } from "@/lib/auth/google";

type Mode = "signin" | "signup";
/** form: log in / sign up. code: confirm a new account. forgot: ask for a reset link. sent: check your email. */
type Step = "form" | "code" | "forgot" | "sent";

interface LoginFormProps {
  /** Where to go after logging in (same-site path). */
  next: string;
  /** Set when a sign-in (Google) or password reset link came back with an error. */
  failed?: "auth" | "reset";
}

const INPUT =
  "w-full rounded-lg bg-[#09090B] border border-[#27272A] px-3.5 py-2.5 text-sm text-[#F4F4F5] placeholder:text-[#52525B] focus:outline-none focus:border-[#8B5CF6] transition-colors";
const PRIMARY =
  "w-full rounded-lg bg-[#F4F4F5] text-[#09090B] font-medium text-sm py-2.5 hover:bg-white disabled:opacity-40 transition-colors cursor-pointer";
const LINK = "hover:text-[#F4F4F5] cursor-pointer";

const FAILED_MESSAGES = {
  auth: "Sign-in didn't finish. Please try again.",
  reset: "That reset link didn't work. It may have expired or been opened in another browser. Ask for a new one below.",
};

const WRONG_PASSWORD =
  "Email or password is wrong. Signed up with Google? Use Continue with Google, or tap Forgot password to set a password.";

export function LoginForm({ next, failed }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>(failed === "reset" ? "forgot" : "form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(failed ? FAILED_MESSAGES[failed] : "");
  const [info, setInfo] = useState("");

  const finish = () => {
    router.replace(next);
    router.refresh();
  };

  const goTo = (target: Step) => {
    setStep(target);
    setCode("");
    setError("");
    setInfo("");
  };

  const signInWithGoogle = async () => {
    setError("");
    setBusy(true);
    const message = await startGoogleSignIn(next);
    if (message) {
      setError(message);
      setBusy(false);
    }
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const supabase = createSupabaseBrowserClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (/not confirmed/i.test(error.message)) {
          // Account exists but the email was never confirmed. Send a fresh code.
          await supabase.auth.resend({ type: "signup", email });
          setStep("code");
          setInfo(`Your email isn't confirmed yet. We sent a 6-digit code to ${email}.`);
        } else {
          // Accounts made with Google have no password, which looks exactly like a wrong one.
          setError(error.message === "Invalid login credentials" ? WRONG_PASSWORD : error.message);
        }
        setBusy(false);
        return;
      }
      finish();
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (data.user && data.user.identities?.length === 0) {
      // Supabase returns an empty identity list when the email already has an account.
      setError("An account with this email already exists. Sign in instead.");
      setMode("signin");
      return;
    }
    setStep("code");
    setInfo(`We sent a 6-digit code to ${email}.`);
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const { error } = await createSupabaseBrowserClient().auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });
    if (error) {
      setBusy(false);
      setError("That code didn't work. Check it, or send a new one.");
      return;
    }
    finish();
  };

  const resendCode = async () => {
    setError("");
    setInfo("");
    const { error } = await createSupabaseBrowserClient().auth.resend({ type: "signup", email });
    setInfo(error ? error.message : "New code sent. Check your inbox and spam folder.");
  };

  // ─── Forgot password ───

  const sendResetLink = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    // The email's "Reset password" button goes through the callback (which logs them in)
    // to /reset-password, where they pick the new password. Supabase doesn't say whether
    // the email has an account, so neither do we.
    const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });
    setBusy(false);
    if (error) {
      setError(/rate limit|seconds/i.test(error.message) ? "Please wait a minute before asking for another email." : error.message);
      return;
    }
    setStep("sent");
    if (e === undefined) setInfo("Sent again.");
  };

  const titles: Record<Step, [string, string]> = {
    form: [
      mode === "signin" ? "Welcome back" : "Save your analyses",
      "Log in to keep your analyses and chat with Loopy from any device.",
    ],
    code: ["Check your email", "Enter the 6-digit code we emailed you."],
    forgot: ["Reset your password", "Enter your email and we'll send you a link to reset it."],
    sent: ["Check your email", `If ${email} has an account, we sent it a reset link. Open it in this browser to choose a new password.`],
  };

  return (
    <AuthShell title={titles[step][0]} subtitle={titles[step][1]}>
      {step === "form" && (
        <>
          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-white text-[#09090B] font-medium text-sm py-2.5 hover:bg-[#F4F4F5] disabled:opacity-40 transition-colors cursor-pointer"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#27272A]" />
            <span className="text-[11px] uppercase tracking-wider text-[#52525B]">or</span>
            <div className="flex-1 h-px bg-[#27272A]" />
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 mb-4 rounded-lg bg-[#09090B] border border-[#27272A]">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError("");
                  setInfo("");
                }}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  mode === m ? "bg-[#27272A] text-[#F4F4F5]" : "text-[#A1A1AA] hover:text-[#F4F4F5]"
                }`}
              >
                {m === "signin" ? "Log in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submitPassword} className="space-y-3">
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
            <PasswordInput
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              placeholder="Password (6+ characters)"
              value={password}
              onChange={setPassword}
            />
            {mode === "signin" && (
              <div className="flex justify-end -mt-1">
                <button type="button" onClick={() => goTo("forgot")} className={`text-xs text-[#A1A1AA] ${LINK}`}>
                  Forgot password?
                </button>
              </div>
            )}
            <button type="submit" disabled={busy} className={PRIMARY}>
              {mode === "signin" ? "Log in" : "Create account"}
            </button>
          </form>
        </>
      )}

      {step === "code" && (
        <form onSubmit={verifyCode} className="space-y-3">
          <OtpInput value={code} onChange={setCode} disabled={busy} autoFocus />
          <button type="submit" disabled={busy || code.length !== 6} className={PRIMARY}>
            Verify and continue
          </button>
          <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-1">
            <button type="button" onClick={resendCode} className={LINK}>
              Send a new code
            </button>
            <button type="button" onClick={() => goTo("form")} className={LINK}>
              Use a different email
            </button>
          </div>
        </form>
      )}

      {step === "forgot" && (
        <form onSubmit={sendResetLink} className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
          <button type="submit" disabled={busy} className={PRIMARY}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
          <div className="text-center text-xs text-[#A1A1AA] pt-1">
            <button type="button" onClick={() => goTo("form")} className={LINK}>
              Back to log in
            </button>
          </div>
        </form>
      )}

      {step === "sent" && (
        <div className="space-y-3">
          <p className="text-xs text-[#A1A1AA] leading-relaxed text-center">Didn&apos;t get it? Check your spam folder.</p>
          <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-1">
            <button type="button" onClick={() => sendResetLink()} disabled={busy} className={LINK}>
              Send it again
            </button>
            <button type="button" onClick={() => goTo("form")} className={LINK}>
              Back to log in
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-xs text-[#F87171] leading-relaxed">{error}</p>}
      {info && <p className="mt-4 text-xs text-[#A1A1AA] leading-relaxed">{info}</p>}
    </AuthShell>
  );
}
