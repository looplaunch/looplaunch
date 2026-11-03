"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { FIELD } from "@/components/ui/fields";

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
        className={`${FIELD} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 w-10 flex items-center justify-center rounded-r-[10px] text-[#8B8B94] hover:text-white transition-colors cursor-pointer"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
