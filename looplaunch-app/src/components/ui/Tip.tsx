"use client";

import type { ReactElement, ReactNode } from "react";
import WarmTooltip, { WarmTooltipGroup, type WarmTooltipSide } from "@/components/reactbits/WarmTooltip";

interface TipProps {
  label: ReactNode;
  side?: WarmTooltipSide;
  children: ReactElement<Record<string, unknown>>;
}

/**
 * A tooltip for icon buttons (React Bits WarmTooltip): the first one waits a moment, then its
 * neighbours in the same <TipGroup> open at once while the pointer moves between them.
 */
export function Tip({ label, side = "top", children }: TipProps) {
  return (
    <WarmTooltip content={label} side={side} size="sm" surfaceColor="#F4F4F5" inkColor="#09090B" radius={8} delay={350}>
      {children}
    </WarmTooltip>
  );
}

export const TipGroup = WarmTooltipGroup;
