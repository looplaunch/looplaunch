"use client";

import { useEffect, useState } from "react";
import SpringCheck from "@/components/reactbits/SpringCheck";

interface SetupStep {
  label: string;
  done: boolean;
}

/**
 * The getting-started list (React Bits SpringCheck). It reads the account's real progress; finished
 * steps arrive unticked and tick themselves one after another, with the label struck through.
 */
export function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const [played, setPlayed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPlayed(true), 450);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ol className="space-y-0.5">
      {steps.map((step) => (
        <li key={step.label}>
          <SpringCheck
            label={step.label}
            checked={played && step.done}
            disabled
            ariaLabel={`${step.label}${step.done ? " (done)" : " (to do)"}`}
            boxSize={20}
            boxRadius={999}
            fontSize={14}
            color="#F4F4F5"
            fillColor="#8B5CF6"
            checkColor="#FFFFFF"
            doneOpacity={0.55}
            strike="left"
            className="disabled:!opacity-100 disabled:!cursor-default"
          />
        </li>
      ))}
    </ol>
  );
}
