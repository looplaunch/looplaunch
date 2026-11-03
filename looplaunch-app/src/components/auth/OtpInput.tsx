"use client";

import CodeSlots from "@/components/reactbits/CodeSlots";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** "error" shakes the slots red, e.g. after a wrong code */
  status?: "idle" | "error" | "success";
}

/**
 * One slot per digit (React Bits CodeSlots): digits spring into place, and pasting a full code
 * or an SMS/email autofill fills every slot.
 */
export function OtpInput({ value, onChange, length = 6, disabled, autoFocus, status = "idle" }: OtpInputProps) {
  return (
    <CodeSlots
      length={length}
      value={value}
      onChange={onChange}
      disabled={disabled}
      autoFocus={autoFocus}
      status={status}
      slotSize={42}
      gap={8}
      radius={10}
      accentColor="#F4F4F5"
      inkColor="#F4F4F5"
      slotColor="#1C1C21"
      digitColor="#09090B"
      dangerColor="#F87171"
      ariaLabel={`${length}-digit code`}
    />
  );
}
