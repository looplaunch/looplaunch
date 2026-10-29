"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const INPUT =
  "w-full rounded-lg bg-[#09090B] border border-[#27272A] pl-3.5 pr-10 py-2.5 text-sm text-[#F4F4F5] placeholder:text-[#52525B] focus:outline-none focus:border-[#8B5CF6] transition-colors";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
}

/** Password field with a show/hide button, so people can check what they typed. */
export function PasswordInput({ value, onChange, id, placeholder, autoComplete, required, minLength, autoFocus }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        className={INPUT}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 w-10 flex items-center justify-center text-[#71717A] hover:text-[#F4F4F5] cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
