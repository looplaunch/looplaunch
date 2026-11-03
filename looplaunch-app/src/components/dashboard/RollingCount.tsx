"use client";

import { useEffect, useState } from "react";
import Counter from "@/components/reactbits/Counter";

/** A count that rolls up from zero when the page opens (React Bits Counter), then follows its value. */
export function RollingCount({ value, suffix, delay = 250 }: { value: number; suffix?: string; delay?: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setShown(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return <Counter value={shown} suffix={suffix} fontSize="1em" fade={0} />;
}
