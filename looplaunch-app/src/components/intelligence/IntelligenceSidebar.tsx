"use client";

import { useState } from "react";
import {
  Search,
  ExternalLink,
  HelpCircle,
  TrendingUp,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";
import type { MarketIntelligence, CompetitorIntelligence } from "@/lib/intelligence/types";

interface IntelligenceSidebarProps {
  marketIntelligence?: MarketIntelligence;
  competitorIntelligence?: CompetitorIntelligence[];
  companyName: string;
}

export function IntelligenceSidebar({
  marketIntelligence,
  competitorIntelligence,
  companyName,
}: IntelligenceSidebarProps) {
  const [activeTab, setActiveTab] = useState<"search" | "ads" | "competitors">("search");
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const googleAds = marketIntelligence?.googleAds || [];
  const questions = marketIntelligence?.peopleAlsoAsk || [];
  const organicKeywords = marketIntelligence?.organicKeywords || [];
  const competitors = competitorIntelligence || [];

  const totalSignals = googleAds.length + questions.length + organicKeywords.length;

  return (
    <aside className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col rounded-2xl bg-[#111114] border border-[#27272A] overflow-hidden lg:sticky lg:top-20 max-h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="p-4 border-b border-[#27272A] flex items-center justify-between bg-[#151518]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 flex items-center justify-center">
            <Search className="w-3.5 h-3.5 text-[#A78BFA]" />
          </div>
          <span className="text-xs font-semibold text-[#F4F4F5] tracking-tight">
            Live Search & Ad Intel
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#1A1A1E] border border-[#27272A] text-[10px] font-mono text-[#A1A1AA]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span>SERP Active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#27272A] bg-[#0E0E11] p-1 gap-1 text-[11px] font-medium">
        <button
          onClick={() => setActiveTab("search")}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer ${
            activeTab === "search"
              ? "bg-[#1F1F24] text-[#F4F4F5] shadow-xs"
              : "text-[#71717A] hover:text-[#A1A1AA]"
          }`}
        >
          Questions ({questions.length})
        </button>
        <button
          onClick={() => setActiveTab("ads")}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer ${
            activeTab === "ads"
              ? "bg-[#1F1F24] text-[#F4F4F5] shadow-xs"
              : "text-[#71717A] hover:text-[#A1A1AA]"
          }`}
        >
          Ads ({googleAds.length})
        </button>
        <button
          onClick={() => setActiveTab("competitors")}
          className={`flex-1 py-1.5 px-2 rounded-lg transition-all text-center cursor-pointer ${
            activeTab === "competitors"
              ? "bg-[#1F1F24] text-[#F4F4F5] shadow-xs"
              : "text-[#71717A] hover:text-[#A1A1AA]"
          }`}
        >
          Landscape ({competitors.length})
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar text-xs">
        {/* ─── TAB 1: Real Search Questions (People Also Ask) ─── */}
        {activeTab === "search" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] pb-1">
              <span>Google &quot;People Also Ask&quot;</span>
              <span className="text-[10px] text-[#71717A] font-mono">Real Buyer Queries</span>
            </div>

            {questions.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#17171B]/60 border border-[#27272A] text-center text-[#71717A]">
                <HelpCircle className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                <p>No questions captured yet</p>
              </div>
            ) : (
              questions.map((q, idx) => {
                const isExpanded = expandedQuestion === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-xl bg-[#16161A] border border-[#27272A] hover:border-[#8B5CF6]/30 transition-all overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                      className="w-full p-2.5 flex items-start justify-between text-left gap-2 cursor-pointer"
                    >
                      <span className="text-[12px] font-medium text-[#F4F4F5] leading-snug">
                        {q.question}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#71717A] shrink-0 mt-0.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#71717A] shrink-0 mt-0.5" />
                      )}
                    </button>
                    {isExpanded && q.snippet && (
                      <div className="px-2.5 pb-2.5 pt-1 text-[11px] text-[#A1A1AA] leading-relaxed border-t border-[#222227] bg-[#111114]">
                        <p>{q.snippet}</p>
                        {q.link && (
                          <a
                            href={q.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-[#A78BFA] hover:underline"
                          >
                            <span>Google Source</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Organic Keywords List */}
            {organicKeywords.length > 0 && (
              <div className="pt-3 border-t border-[#27272A]">
                <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] mb-2">
                  <span>Top Organic Search Results</span>
                  <TrendingUp className="w-3 h-3 text-[#10B981]" />
                </div>
                <div className="space-y-1.5">
                  {organicKeywords.slice(0, 5).map((org, idx) => (
                    <a
                      key={idx}
                      href={org.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded-lg bg-[#141418] hover:bg-[#1A1A20] border border-[#222227] transition-all group"
                    >
                      <div className="flex items-center justify-between text-[11px] font-medium text-[#F4F4F5] group-hover:text-[#A78BFA] transition-colors">
                        <span className="truncate pr-2">#{org.position} {org.title}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-40 group-hover:opacity-100" />
                      </div>
                      {org.snippet && (
                        <p className="text-[10px] text-[#71717A] line-clamp-1 mt-0.5">
                          {org.snippet}
                        </p>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: Competitor Google Ads ─── */}
        {activeTab === "ads" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] pb-1">
              <span>Active Competitor Google Ads</span>
              <span className="text-[10px] text-[#71717A] font-mono">Paid Search</span>
            </div>

            {googleAds.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#17171B]/60 border border-[#27272A] text-center text-[#71717A]">
                <Target className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                <p className="text-xs">No active paid ads currently detected for this query.</p>
                <p className="text-[10px] text-[#52525B] mt-1">Competitors may rely primarily on organic search or social.</p>
              </div>
            ) : (
              googleAds.map((ad, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#16161A] border border-[#27272A] hover:border-[#FACC15]/30 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20">
                      Ad #{idx + 1}
                    </span>
                    {ad.displayedLink && (
                      <span className="text-[10px] text-[#71717A] truncate max-w-[140px]">
                        {ad.displayedLink}
                      </span>
                    )}
                  </div>
                  <h4 className="text-[12px] font-semibold text-[#F4F4F5] leading-snug">
                    {ad.title}
                  </h4>
                  {ad.snippet && (
                    <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                      {ad.snippet}
                    </p>
                  )}
                  {ad.link && (
                    <a
                      href={ad.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-[#A78BFA] hover:underline pt-1"
                    >
                      <span>Visit Ad Destination</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ─── TAB 3: Competitor Landscape ─── */}
        {activeTab === "competitors" && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] pb-1">
              <span>Identified Competitors</span>
              <span className="text-[10px] text-[#71717A] font-mono">{companyName} Rivals</span>
            </div>

            {competitors.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#17171B]/60 border border-[#27272A] text-center text-[#71717A]">
                <Sparkles className="w-5 h-5 mx-auto mb-1.5 opacity-40" />
                <p>No competitors provided</p>
              </div>
            ) : (
              competitors.map((comp, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#16161A] border border-[#27272A] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-[12px] font-semibold text-[#F4F4F5]">
                      {comp.name}
                    </h4>
                    {comp.website && (
                      <a
                        href={comp.website.startsWith("http") ? comp.website : `https://${comp.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#A78BFA] hover:underline flex items-center gap-1"
                      >
                        <span>Link</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  {comp.description && (
                    <p className="text-[11px] text-[#A1A1AA] line-clamp-2">
                      {comp.description}
                    </p>
                  )}
                  {comp.differentiators && comp.differentiators.length > 0 && (
                    <div className="pt-1.5 flex flex-wrap gap-1">
                      {comp.differentiators.slice(0, 2).map((diff, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-[#1C1C22] text-[10px] text-[#71717A]"
                        >
                          {diff}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 bg-[#0C0C0E] border-t border-[#222227] text-[10px] text-[#52525B] flex items-center justify-between">
        <span>Powered by SerpApi & Tavily</span>
        <span>{totalSignals} Live Signals</span>
      </div>
    </aside>
  );
}
