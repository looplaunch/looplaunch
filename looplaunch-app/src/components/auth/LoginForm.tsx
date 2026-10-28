"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";
import { OtpInput } from "@/components/auth/OtpInput";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

type Mode = "signin" | "signup";
type Step = "form" | "code";

interface LoginFormProps {
  /** Where to go after logging in (same-site path). */
  next: string;
  /** Set when Google sign-in came back with an error. */
  authFailed?: boolean;
}

const INPUT =
  "w-full rounded-lg bg-[#09090B] border border-[#27272A] px-3.5 py-2.5 text-sm text-[#F4F4F5] placeholder:text-[#52525B] focus:outline-none focus:border-[#8B5CF6] transition-colors";
const PRIMARY =
  "w-full rounded-lg bg-[#F4F4F5] text-[#09090B] font-medium text-sm py-2.5 hover:bg-white disabled:opacity-40 transition-colors cursor-pointer";

export function LoginForm({ next, authFailed }: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(authFailed ? "Google sign-in didn't finish. Please try again." : "");
  const [info, setInfo] = useState("");

  const finish = () => {
    router.replace(next);
    router.refresh();
  };

  const signInWithGoogle = async () => {
    setError("");
    setBusy(true);
    const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setError(error.message);
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
          setError(error.message === "Invalid login credentials" ? "Email or password is wrong." : error.message);
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

  return (
    <div className="min-h-screen bg-[#09090B] text-[#F4F4F5] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#111114] border border-[#27272A] rounded-xl p-7 shadow-lg">
        <div className="flex flex-col items-center text-center mb-6">
          <LoopyMascot size={56} />
          <h1 className="mt-3 text-lg font-semibold tracking-tight">
            {step === "code" ? "Check your email" : mode === "signin" ? "Welcome back" : "Save your analyses"}
          </h1>
          <p className="mt-1 text-sm text-[#A1A1AA]">
            {step === "code"
              ? "Enter the 6-digit code we emailed you."
              : "Log in to keep your analyses and chat with Loopy from any device."}
          </p>
        </div>

        {step === "form" && (
          <>
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2.5 rounded-lg bg-white text-[#09090B] font-medium text-sm py-2.5 hover:bg-[#F4F4F5] disabled:opacity-40 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.4 7.4 24 12 24z" />
                <path fill="#FBBC05" d="M5.4 14.4c-.2-.7-.4-1.5-.4-2.4s.1-1.6.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z" />
                <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.6 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
              </svg>
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
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT}
              />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder="Password (6+ characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT}
              />
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
              <button type="button" onClick={resendCode} className="hover:text-[#F4F4F5] cursor-pointer">
                Send a new code
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setError("");
                  setInfo("");
                }}
                className="hover:text-[#F4F4F5] cursor-pointer"
              >
                Use a different email
              </button>
            </div>
          </form>
        )}

        {error && <p className="mt-4 text-xs text-[#F87171]">{error}</p>}
        {info && <p className="mt-4 text-xs text-[#A1A1AA]">{info}</p>}

        <Link href="/" className="block mt-6 text-center text-xs text-[#71717A] hover:text-[#F4F4F5] transition-colors">
          ← Back to Loop Launch
        </Link>
      </div>
    </div>
  );
}
