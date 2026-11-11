"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe } from "lucide-react";
import { displayDomain } from "@/lib/intelligence/summary";

interface StartAnalysisFormProps {
  /** Pre-filled from the profile's company website */
  defaultWebsite?: string;
  /** Label on the submit button */
  action?: string;
  /** Field above the button, for narrow panels */
  stacked?: boolean;
}

/**
 * A website field that hands off to /new with the site filled in, where the usual
 * questions sharpen the analysis before /api/intelligence/gather runs.
 */
export function StartAnalysisForm({ defaultWebsite = "", action = "Analyse this website", stacked = false }: StartAnalysisFormProps) {
  const router = useRouter();
  const id = useId();
  const errorId = `${id}-error`;
  const [domain, setDomain] = useState(displayDomain(defaultWebsite));
  const [error, setError] = useState("");
  const [going, setGoing] = useState(false);

  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  const valid = clean.includes(".") && clean.length >= 4 && !clean.endsWith(".");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setError("Enter a website like yourcompany.com");
      return;
    }
    setGoing(true);
    router.push(`/new?website=${encodeURIComponent(`https://${clean}`)}`);
  };

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor={id} className="block text-[13px] text-[#B4B4BC] mb-2">
        Company website
      </label>
      <div className={`flex flex-col gap-2 ${stacked ? "" : "sm:flex-row"}`}>
        <div className="relative flex-1 min-w-0">
          <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B8B94]" aria-hidden="true" />
          <input
            id={id}
            type="text"
            inputMode="url"
            autoComplete="url"
            spellCheck={false}
            placeholder="yourcompany.com"
            value={domain}
            onChange={(e) => {
              setDomain(e.target.value.replace(/^https?:\/\//i, ""));
              if (error) setError("");
            }}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            className="w-full h-11 pl-10 pr-3 rounded-full bg-[#1C1C21] text-[15px] pointer-coarse:text-[16px] text-[#F4F4F5] placeholder:text-[#8B8B94] border border-[#2E2E35] hover:border-[#3F3F48] focus:border-[#8B5CF6] outline-none transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={going}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-[#F4F4F5] text-[#09090B] text-sm font-semibold hover:bg-white active:scale-[0.98] disabled:opacity-60 disabled:cursor-wait transition shrink-0"
        >
          {going ? "Opening…" : action}
          {!going && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-[13px] text-[#F87171]">
          {error}
        </p>
      )}
    </form>
  );
}
