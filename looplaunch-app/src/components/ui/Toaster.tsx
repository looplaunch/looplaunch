"use client";

import { useSyncExternalStore } from "react";
import { AlertCircle, Check, Info } from "lucide-react";
import SwipeToast from "@/components/reactbits/SwipeToast";
import { dismissToast, getToasts, subscribeToasts, type ToastItem } from "@/lib/toast";

const EMPTY: ToastItem[] = [];

const ICONS = {
  success: (
    <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#8B5CF6] text-white">
      <Check className="w-3 h-3" strokeWidth={3} />
    </span>
  ),
  error: <AlertCircle className="text-[#F87171]" strokeWidth={2.2} />,
  info: <Info className="text-[#B4B4BC]" strokeWidth={2.2} />,
} as const;

/** The stack of toasts, bottom right (bottom centre on a phone). Mounted once in the root layout. */
export function Toaster() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, () => EMPTY);
  if (!items.length) return null;

  return (
    <div
      className="fixed z-[70] bottom-[calc(104px+env(safe-area-inset-bottom,0px))] right-4 left-4 sm:left-auto sm:right-6 flex flex-col items-end pointer-events-none"
      aria-live="polite"
    >
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto w-full sm:w-[360px]">
          <SwipeToast
            inline
            title={item.title}
            description={item.description}
            icon={ICONS[item.tone]}
            onClose={() => dismissToast(item.id)}
            background="#1C1C21"
            color="#F4F4F5"
            fuseColor={item.tone === "error" ? "#F87171" : "#8B5CF6"}
            width={360}
            radius={16}
            duration={item.tone === "error" ? 6000 : 3600}
            closeButton
          />
        </div>
      ))}
    </div>
  );
}
