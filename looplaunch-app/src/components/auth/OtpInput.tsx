"use client";

import { useRef } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * One box per digit. Typing moves to the next box, Backspace goes back,
 * and pasting a full code (or an SMS/email autofill) fills every box.
 */
export function OtpInput({ value, onChange, length = 6, disabled, autoFocus }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const focusBox = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  /** Put `pasted` digits into the code starting at box `i`. */
  const insertAt = (i: number, pasted: string) => {
    onChange((value.slice(0, i) + pasted).slice(0, length));
    focusBox(i + pasted.length);
  };

  const handleChange = (i: number, raw: string) => {
    let typed = raw.replace(/\D/g, "");
    if (!typed) {
      onChange(value.slice(0, i) + value.slice(i + 1));
      return;
    }
    // A filled box that gets one more digit now holds two: keep only the new one.
    if (digits[i] && typed.length === 2) typed = typed.replace(digits[i], "");
    if (typed.length === 1) {
      onChange((value.slice(0, i) + typed + value.slice(i + 1)).slice(0, length));
      focusBox(i + 1);
    } else {
      insertAt(i, typed);
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focusBox(i - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusBox(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusBox(i + 1);
    }
  };

  const handlePaste = (i: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
    if (pasted) insertAt(i, pasted);
  };

  return (
    <div className="flex justify-between gap-2" role="group" aria-label={`${length}-digit code`}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          className="w-11 h-12 text-center text-lg font-semibold rounded-lg bg-[#09090B] border border-[#27272A] text-[#F4F4F5] focus:outline-none focus:border-[#8B5CF6] disabled:opacity-50 transition-colors"
        />
      ))}
    </div>
  );
}
