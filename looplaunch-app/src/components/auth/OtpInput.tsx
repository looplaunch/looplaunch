"use client";

import CodeSlots from "@/components/reactbits/CodeSlots";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called once all digits are in, e.g. to submit without a click */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** "error" shakes the slots red; "success" merges them into one green bar with a tick */
  status?: "idle" | "error" | "success";
}

/**
 * One slot per digit (React Bits CodeSlots): the slots rise in one by one, a purple ring glides to the
 * slot being typed in, digits spring into white tiles, and pasting or autofilling a code fills every slot.
 */
export function OtpInput({ value, onChange, onComplete, length = 6, disabled, autoFocus, status = "idle" }: OtpInputProps) {
  return (
    <div className="flex justify-center max-[400px]:[zoom:0.86]">
      <CodeSlots
        length={length}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        disabled={disabled && status !== "success"}
        autoFocus={autoFocus}
        status={status}
        slotSize={46}
        gap={10}
        radius={12}
        accentColor="#F4F4F5"
        inkColor="#F4F4F5"
        slotColor="#1E1E24"
        ringColor="#3A3A44"
        focusColor="#8B5CF6"
        digitColor="#09090B"
        dangerColor="#F87171"
        successColor="#34D399"
        onSuccessColor="#04210F"
        ariaLabel={`${length}-digit code`}
      />
    </div>
  );
}
