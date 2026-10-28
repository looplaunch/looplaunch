"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, X } from "lucide-react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";

/**
 * A simple mind map of one answer, for people who'd rather not read the whole thing.
 * Sections become branches and each step becomes a short point. Tapping a branch
 * opens it; tapping a point shows the full step right inside the map.
 */

export interface MindMapLeaf {
  /** Short, scannable label */
  label: string;
  /** Full text, shown when the point is opened */
  detail?: string;
}

export interface MindMapBranch {
  label: string;
  leaves: MindMapLeaf[];
}

export interface MindMapData {
  root: string;
  /** Opening paragraph of the answer, shown when the centre is tapped */
  summary?: string;
  branches: MindMapBranch[];
}

const MAX_BRANCHES = 8;
const MAX_LEAVES = 8;

function clean(text: string): string {
  return text
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:：]$/, "")
    .trim();
}

/** "MON" → "Mon", "STOP" → "Stop"; mixed-case text is left alone. */
function tidyCase(text: string): string {
  return text === text.toUpperCase() && /[A-Z]/.test(text) ? text.charAt(0) + text.slice(1).toLowerCase() : text;
}

function firstWords(text: string, n: number): string {
  const words = text.split(" ");
  if (words.length <= n) return text;
  return `${words.slice(0, n).join(" ").replace(/[,.;:!?-]+$/, "")}…`;
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function toLeaf(text: string, group?: string): MindMapLeaf {
  let label: string;
  let detail: string;

  const bold = text.match(/^\*\*([^*]{1,60})\*\*\s*[:\-–—]?\s*(.*)$/);
  if (bold) {
    // "**MON** — Audit your site…" or "**Primary KPI:** Cost per sale…"
    const head = clean(bold[1]);
    detail = clean(bold[2]);
    label = detail && head.length <= 5 ? `${tidyCase(head)}: ${firstWords(detail, 5)}` : tidyCase(head) || firstWords(detail, 7);
  } else {
    detail = clean(text);
    const lead = detail.match(/^([A-Za-z0-9 ]{1,14}?)\s*[:—–]\s+(.+)$/);
    label = lead ? `${tidyCase(lead[1])}: ${firstWords(lead[2], 5)}` : firstWords(detail, 7);
  }

  if (group) label = `${group}: ${label}`;
  const plainLabel = label.replace(/…$/, "");
  const hasMore = detail && detail.length > plainLabel.replace(/^[^:]+:\s*/, "").length + 3;
  return { label: shorten(label, 64), detail: hasMore ? detail : undefined };
}

/** Lines that talk to the reader ("Would you like me to…") aren't part of the plan. */
const isFollowUp = (line: string) => /\*\*next step|would you like me to/i.test(line);

export function parseMindMap(markdown: string, fallbackRoot: string): MindMapData {
  const lines = markdown.split("\n");
  const hasHeadings = lines.some((l) => /^#{1,4}\s+\S/.test(l.trim()));
  let root = fallbackRoot;
  let summary: string | undefined;
  const branches: MindMapBranch[] = [];
  let current: MindMapBranch | null = null;
  let group: string | undefined;

  const startBranch = (label: string): MindMapBranch => {
    const b: MindMapBranch = { label: shorten(tidyCase(clean(label)), 64), leaves: [] };
    branches.push(b);
    group = undefined;
    return b;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line) || isFollowUp(line)) continue;

    const heading = line.match(/^(#{1,4})\s+(.*)/);
    if (heading) {
      // A single top-level title becomes the centre of the map.
      if (heading[1].length === 1 && branches.length === 0 && root === fallbackRoot) {
        root = shorten(clean(heading[2]), 40);
        continue;
      }
      current = startBranch(heading[2]);
      continue;
    }

    const isListItem = /^(?:[-*•]|\d+[.)])\s+/.test(line);
    const body = line.replace(/^(?:[-*•]|\d+[.)])\s+/, "");

    // "**STOP:**" on its own line labels the points below it.
    const boldOnly = body.match(/^\*\*([^*]{2,40})\*\*:?$/);
    if (boldOnly) {
      if (current) group = tidyCase(clean(boldOnly[1]));
      else if (!hasHeadings) current = startBranch(boldOnly[1]);
      continue;
    }

    const boldLead = /^\*\*[^*]{1,60}\*\*/.test(body);

    // Without headings, paragraphs that start with a bold label act as sections.
    if (!hasHeadings && boldLead && !isListItem && !/^\*\*[^*]{1,5}\*\*\s*[—–-]/.test(body)) {
      const m = body.match(/^\*\*([^*]{1,60})\*\*\s*[:\-–—]?\s*(.*)$/);
      current = startBranch(m ? m[1] : body);
      if (m && m[2]) current.leaves.push(toLeaf(m[2]));
      continue;
    }

    if (!current) {
      // Text before the first section: the opening paragraph explains the whole map.
      if (!isListItem && !boldLead) {
        if (!summary) summary = clean(body);
        continue;
      }
      current = startBranch("Key points");
    }

    if (isListItem || boldLead || current.leaves.length === 0) {
      current.leaves.push(toLeaf(body, group));
    }
  }

  return {
    root,
    summary: summary ? shorten(summary, 600) : undefined,
    branches: branches
      .filter((b) => b.label && b.leaves.length > 0)
      .slice(0, MAX_BRANCHES)
      .map((b) => ({ ...b, leaves: b.leaves.slice(0, MAX_LEAVES) })),
  };
}

// ──────────────────────────────────────────────
// Dialog
// ──────────────────────────────────────────────

const HUES = ["#F472B6", "#60A5FA", "#34D399", "#FBBF24", "#A78BFA", "#F87171", "#22D3EE", "#FB923C"];
const LINE = "#3F3F46";
const ROW_PAD = 8; // vertical padding around every node row
const NODE_H = 40; // one-line node height; longer labels wrap and grow downwards
const ROOT_H = 56;
const ARM = 32; // length of each connector arm
// Connectors meet each node at the middle of its first line (10px padding + half a 20px line).
const CENTER_Y = ROW_PAD + NODE_H / 2;

/** The elbow lines that join a row to its parent's spine. */
function Connector({ first, last }: { first: boolean; last: boolean }) {
  return (
    <>
      {!first && <span aria-hidden="true" className="absolute left-0 top-0 w-px" style={{ height: CENTER_Y, background: LINE }} />}
      {!last && <span aria-hidden="true" className="absolute left-0 bottom-0 w-px" style={{ top: CENTER_Y, background: LINE }} />}
      <span aria-hidden="true" className="absolute left-0 h-px" style={{ top: CENTER_Y, width: ARM, background: LINE }} />
    </>
  );
}

const Stub = () => (
  <span aria-hidden="true" className="block h-px shrink-0" style={{ width: ARM, marginTop: NODE_H / 2, background: LINE }} />
);

interface MindMapDialogProps {
  open: boolean;
  onClose: () => void;
  data: MindMapData | null;
}

export function MindMapDialog({ open, onClose, data }: MindMapDialogProps) {
  const [openBranches, setOpenBranches] = useState<Set<number>>(() => new Set([0]));
  const [openLeaf, setOpenLeaf] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const branchCount = data?.branches.length ?? 0;
  const allOpen = branchCount > 0 && openBranches.size === branchCount;

  const toggleBranch = (i: number) =>
    setOpenBranches((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <AnimatePresence>
      {open && data && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Mind map of this answer"
            className="relative w-full max-w-5xl max-h-full flex flex-col rounded-2xl bg-[#0D0D10] border border-[#27272A] overflow-hidden"
            initial={{ y: 16, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[#27272A]">
              <div className="flex items-center gap-2.5 min-w-0">
                <LoopyMascot size={30} />
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-[#F4F4F5] truncate">Mind map</h2>
                  <p className="text-xs text-[#A1A1AA] truncate">Tap a branch to open it. Tap a point to read the full step.</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {branchCount > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenBranches(allOpen ? new Set() : new Set(data.branches.map((_, i) => i)));
                      setOpenLeaf(null);
                    }}
                    className="px-2.5 h-8 rounded-lg text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#17171B] transition-colors cursor-pointer"
                  >
                    {allOpen ? "Close all" : "Open all"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#17171B] transition-colors cursor-pointer"
                  aria-label="Close mind map"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="overflow-auto px-4 sm:px-8 py-6">
              {branchCount === 0 ? (
                <p className="text-sm text-[#A1A1AA] text-center py-10">This answer is too short for a mind map.</p>
              ) : (
                <div className="flex items-start w-max mx-auto">
                  {/* Centre */}
                  <div className="w-48 shrink-0" style={{ marginTop: CENTER_Y - ROOT_H / 2 }}>
                    <button
                      type="button"
                      onClick={() => data.summary && setShowSummary((s) => !s)}
                      aria-expanded={data.summary ? showSummary : undefined}
                      className={`w-full rounded-2xl bg-[#F4F4F5] text-[#09090B] px-4 text-center text-sm font-semibold leading-snug flex items-center justify-center ${
                        data.summary ? "cursor-pointer hover:bg-white" : "cursor-default"
                      }`}
                      style={{ height: ROOT_H }}
                    >
                      <span className="line-clamp-2">{data.root}</span>
                    </button>
                    {showSummary && data.summary && (
                      <p className="mt-2 rounded-xl bg-[#141418] border border-[#27272A] p-3 text-[12.5px] leading-relaxed text-[#D4D4D8]">
                        {data.summary}
                      </p>
                    )}
                  </div>
                  <span aria-hidden="true" className="block h-px shrink-0" style={{ width: ARM, marginTop: CENTER_Y, background: LINE }} />

                  {/* Branches */}
                  <ul>
                    {data.branches.map((branch, bi) => {
                      const hue = HUES[bi % HUES.length];
                      const isOpen = openBranches.has(bi);
                      return (
                        <li
                          key={bi}
                          className="relative flex items-start"
                          style={{ paddingLeft: ARM, paddingTop: ROW_PAD, paddingBottom: ROW_PAD }}
                        >
                          <Connector first={bi === 0} last={bi === branchCount - 1} />
                          <button
                            type="button"
                            onClick={() => toggleBranch(bi)}
                            aria-expanded={isOpen}
                            title={branch.label}
                            className="w-56 shrink-0 flex items-start gap-2 rounded-xl px-3 py-2.5 bg-[#17171B] hover:bg-[#1F1F24] border transition-colors cursor-pointer"
                            style={{ minHeight: NODE_H, borderColor: isOpen ? `${hue}99` : "#27272A" }}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: hue }} />
                            <span className="flex-1 line-clamp-2 text-left text-[13px] leading-5 font-semibold text-[#F4F4F5]">
                              {branch.label}
                            </span>
                            <span className="text-[11px] leading-5 text-[#71717A] tabular-nums">{branch.leaves.length}</span>
                            <ChevronRight
                              className={`w-3.5 h-3.5 mt-[3px] text-[#71717A] shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                            />
                          </button>

                          {isOpen && (
                            <>
                              <Stub />
                              <motion.ul
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.18 }}
                                style={{ marginTop: -ROW_PAD }}
                              >
                                {branch.leaves.map((leaf, li) => {
                                  const key = `${bi}-${li}`;
                                  const leafOpen = openLeaf === key;
                                  return (
                                    <li
                                      key={key}
                                      className="relative"
                                      style={{ paddingLeft: ARM, paddingTop: ROW_PAD, paddingBottom: ROW_PAD }}
                                    >
                                      <Connector first={li === 0} last={li === branch.leaves.length - 1} />
                                      <button
                                        type="button"
                                        onClick={() => leaf.detail && setOpenLeaf(leafOpen ? null : key)}
                                        aria-expanded={leaf.detail ? leafOpen : undefined}
                                        className={`w-72 text-left rounded-xl border px-3 py-2.5 transition-colors ${
                                          leaf.detail ? "cursor-pointer hover:border-[#3F3F46]" : "cursor-default"
                                        } ${leafOpen ? "bg-[#17171B]" : "bg-[#111114] border-[#27272A]"}`}
                                        style={{ minHeight: NODE_H, borderColor: leafOpen ? `${hue}99` : undefined }}
                                      >
                                        <span className="flex items-start justify-between gap-2">
                                          <span className="text-[13px] leading-5 text-[#E4E4E7]">{leaf.label}</span>
                                          {leaf.detail && (
                                            <ChevronRight
                                              className={`w-3.5 h-3.5 mt-[3px] text-[#71717A] shrink-0 transition-transform ${
                                                leafOpen ? "rotate-90" : ""
                                              }`}
                                            />
                                          )}
                                        </span>
                                        {leafOpen && leaf.detail && (
                                          <span className="block mt-2 pt-2 border-t border-[#27272A] text-[12.5px] leading-relaxed text-[#D4D4D8]">
                                            {leaf.detail}
                                          </span>
                                        )}
                                      </button>
                                    </li>
                                  );
                                })}
                              </motion.ul>
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
