"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { LoopyMascot } from "@/components/loopy/LoopyMascot";

/**
 * Turns a markdown answer into a visual mind map for people who'd rather not read.
 * Headings (or bold lead-ins) become branches; list items become the leaves.
 */

export interface MindMapBranch {
  label: string;
  leaves: string[];
}

export interface MindMapData {
  root: string;
  branches: MindMapBranch[];
}

const MAX_BRANCHES = 8;
const MAX_LEAVES = 6;

function clean(text: string): string {
  return text
    .replace(/\*\*|__|`/g, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[:：]$/, "");
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  // Prefer cutting at the end of a lead-in label like "Day 1: ..."
  const colon = text.indexOf(":");
  if (colon > 8 && colon < max) return text.slice(0, colon);
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 12)).trimEnd() + "…";
}

export function parseMindMap(markdown: string, fallbackRoot: string): MindMapData {
  const lines = markdown.split("\n");
  const hasHeadings = lines.some((l) => /^#{1,4}\s+\S/.test(l.trim()));
  let root = fallbackRoot;
  const branches: MindMapBranch[] = [];
  let current: MindMapBranch | null = null;

  const startBranch = (label: string): MindMapBranch => {
    const b: MindMapBranch = { label: shorten(clean(label), 48), leaves: [] };
    branches.push(b);
    return b;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || /^(-{3,}|\*{3,}|_{3,})$/.test(line)) continue;

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
    const boldLead = line.match(/^(?:[-*•]\s+|\d+[.)]\s+)?\*\*([^*]{2,60})\*\*[:\s]*(.*)$/);

    if (!hasHeadings && boldLead && !isListItem) {
      // Paragraphs that start with a bold label act as sections when there are no headings.
      current = startBranch(boldLead[1]);
      if (boldLead[2]) current.leaves.push(shorten(clean(boldLead[2]), 90));
      continue;
    }

    if (isListItem) {
      if (!current) current = startBranch("Key points");
      current.leaves.push(shorten(clean(line), 90));
      continue;
    }

    // Plain paragraph: only use it if the branch has nothing yet.
    if (current && current.leaves.length === 0) {
      const firstSentence = clean(line).split(/(?<=[.!?])\s/)[0];
      if (firstSentence) current.leaves.push(shorten(firstSentence, 90));
    }
  }

  return {
    root,
    branches: branches
      .filter((b) => b.label)
      .slice(0, MAX_BRANCHES)
      .map((b) => ({ ...b, leaves: b.leaves.filter(Boolean).slice(0, MAX_LEAVES) })),
  };
}

// Muted, distinct hues so each branch is easy to follow by colour alone.
const HUES = ["#F472B6", "#60A5FA", "#34D399", "#FBBF24", "#A78BFA", "#F87171", "#22D3EE", "#FB923C"];

const ROW = 58;
const PAD = 24;
const ROOT_W = 180;
const BRANCH_X = PAD + ROOT_W + 64;
const BRANCH_W = 210;
const LEAF_X = BRANCH_X + BRANCH_W + 56;
const LEAF_W = 290;
const NODE_H = 46;

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

interface MindMapDialogProps {
  open: boolean;
  onClose: () => void;
  data: MindMapData;
  onAsk?: (question: string) => void;
}

export function MindMapDialog({ open, onClose, data, onAsk }: MindMapDialogProps) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

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

  const layout = useMemo(() => {
    const branches = [];
    let row = 0;
    for (let i = 0; i < data.branches.length; i++) {
      const b = data.branches[i];
      const leaves = collapsed.has(i) ? [] : b.leaves;
      const rows = Math.max(1, leaves.length);
      branches.push({
        ...b,
        i,
        hue: HUES[i % HUES.length],
        y: PAD + (row + rows / 2) * ROW,
        leafYs: leaves.map((_, li) => PAD + (row + li + 0.5) * ROW),
        shown: leaves,
      });
      row += rows;
    }
    const height = PAD * 2 + Math.max(row, 1) * ROW;
    const width = data.branches.some((b) => b.leaves.length) ? LEAF_X + LEAF_W + PAD : BRANCH_X + BRANCH_W + PAD;
    return { branches, height, width, rootY: height / 2 };
  }, [data, collapsed]);

  const toggle = (i: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <AnimatePresence>
      {open && (
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
            className="relative w-full max-w-6xl max-h-full flex flex-col rounded-2xl bg-[#0D0D10] border border-[#27272A] overflow-hidden"
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
                  <p className="text-xs text-[#A1A1AA] truncate">
                    The whole plan at a glance. Tap a branch to fold it{onAsk ? ", or a point to ask about it" : ""}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#17171B] transition-colors cursor-pointer"
                aria-label="Close mind map"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-auto">
              <div className="relative mx-auto" style={{ width: layout.width, height: layout.height }}>
                <svg className="absolute inset-0 pointer-events-none" width={layout.width} height={layout.height} aria-hidden="true">
                  {layout.branches.map((b) => (
                    <g key={b.i}>
                      <path
                        d={curve(PAD + ROOT_W, layout.rootY, BRANCH_X, b.y)}
                        fill="none"
                        stroke={b.hue}
                        strokeOpacity={0.55}
                        strokeWidth={2}
                      />
                      {b.leafYs.map((ly, li) => (
                        <path
                          key={li}
                          d={curve(BRANCH_X + BRANCH_W, b.y, LEAF_X, ly)}
                          fill="none"
                          stroke={b.hue}
                          strokeOpacity={0.35}
                          strokeWidth={1.5}
                        />
                      ))}
                    </g>
                  ))}
                </svg>

                {/* Root */}
                <div
                  className="absolute flex items-center justify-center text-center rounded-2xl bg-[#F4F4F5] text-[#09090B] px-3 font-semibold text-sm leading-snug"
                  style={{ left: PAD, top: layout.rootY - 30, width: ROOT_W, height: 60 }}
                >
                  <span className="line-clamp-2">{data.root}</span>
                </div>

                {layout.branches.map((b) => (
                  <div key={b.i}>
                    <motion.button
                      type="button"
                      onClick={() => toggle(b.i)}
                      aria-expanded={!collapsed.has(b.i)}
                      title={b.label}
                      className="absolute flex items-center gap-2 rounded-xl px-3 text-left text-[13px] font-semibold text-[#F4F4F5] bg-[#17171B] cursor-pointer hover:bg-[#1F1F24] transition-colors"
                      style={{ left: BRANCH_X, top: b.y - NODE_H / 2, width: BRANCH_W, height: NODE_H, border: `1.5px solid ${b.hue}80` }}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * b.i }}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.hue }} />
                      <span className="line-clamp-2 flex-1 leading-snug">{b.label}</span>
                      {b.leaves.length > 0 && (
                        <span className="text-[11px] font-normal text-[#71717A] tabular-nums shrink-0">
                          {collapsed.has(b.i) ? `+${b.leaves.length}` : ""}
                        </span>
                      )}
                    </motion.button>

                    {b.shown.map((leaf, li) => {
                      const Tag = onAsk ? motion.button : motion.div;
                      return (
                        <Tag
                          key={li}
                          {...(onAsk
                            ? {
                                type: "button" as const,
                                onClick: () => {
                                  onAsk(`Explain this step in simple terms, and tell me exactly how to do it: "${leaf}"`);
                                  onClose();
                                },
                              }
                            : {})}
                          title={leaf}
                          className={`absolute flex items-center rounded-lg px-3 text-left text-[12.5px] leading-snug text-[#D4D4D8] bg-[#111114] border border-[#27272A] ${
                            onAsk ? "cursor-pointer hover:border-[#3F3F46] hover:text-[#F4F4F5] transition-colors" : ""
                          }`}
                          style={{ left: LEAF_X, top: b.leafYs[li] - NODE_H / 2, width: LEAF_W, height: NODE_H, borderLeft: `3px solid ${b.hue}` }}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.04 * b.i + 0.03 * li + 0.08 }}
                        >
                          <span className="line-clamp-2">{leaf}</span>
                        </Tag>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
