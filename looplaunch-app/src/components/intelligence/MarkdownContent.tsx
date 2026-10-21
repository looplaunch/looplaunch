"use client";

import React, { useEffect, useState, useMemo } from "react";

interface MarkdownContentProps {
  content: string;
  className?: string;
  animate?: boolean;
}

/**
 * Format inline text styles: bold, inline code, and clean plain text (no decorative italics).
 */
function renderInline(text: string): React.ReactNode[] {
  // Regex to match **bold**, *emphasis*, `code`
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-[#F4F4F5]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Clean emphasis without decorative italic slant per design system
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <span key={i} className="text-[#F4F4F5]">
          {part.slice(1, -1)}
        </span>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="font-mono text-[12px] bg-[#17171B] text-[#F4F4F5] px-1.5 py-0.5 rounded border border-[#27272A]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function MarkdownContent({
  content,
  className = "",
  animate = false,
}: MarkdownContentProps) {
  const [displayedLength, setDisplayedLength] = useState<number>(
    animate ? 0 : content.length
  );

  useEffect(() => {
    if (!animate) {
      setDisplayedLength(content.length);
      return;
    }

    setDisplayedLength(0);
    const totalChars = content.length;
    let current = 0;

    // Smooth typing stream simulation
    const interval = setInterval(() => {
      const step = Math.min(Math.floor(Math.random() * 6) + 4, totalChars - current);
      current += step;
      setDisplayedLength(current);

      if (current >= totalChars) {
        clearInterval(interval);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [content, animate]);

  const activeContent = useMemo(() => {
    if (!animate || displayedLength >= content.length) {
      return content;
    }
    return content.slice(0, displayedLength);
  }, [content, displayedLength, animate]);

  if (!activeContent) return null;

  // Split by double newline to identify block elements
  const blocks = activeContent.split(/\n\s*\n/);
  const isTyping = animate && displayedLength < content.length;

  return (
    <div
      className={`space-y-3.5 text-[#D4D4D8] text-[14px] leading-[1.65] font-normal ${className}`}
    >
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        const isLastBlock = idx === blocks.length - 1;

        // Horizontal rule
        if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
          return <hr key={idx} className="border-t border-[#27272A] my-4" />;
        }

        // Header 3
        if (trimmed.startsWith("### ")) {
          return (
            <h4
              key={idx}
              className="text-[15px] font-semibold text-[#F4F4F5] pt-2 tracking-tight"
            >
              {renderInline(trimmed.replace(/^###\s+/, ""))}
              {isLastBlock && isTyping && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#A1A1AA] animate-pulse align-middle" />
              )}
            </h4>
          );
        }

        // Header 2
        if (trimmed.startsWith("## ")) {
          return (
            <h3
              key={idx}
              className="text-[16px] font-semibold text-[#F4F4F5] pt-2.5 tracking-tight"
            >
              {renderInline(trimmed.replace(/^##\s+/, ""))}
              {isLastBlock && isTyping && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#A1A1AA] animate-pulse align-middle" />
              )}
            </h3>
          );
        }

        // Header 1
        if (trimmed.startsWith("# ")) {
          return (
            <h2
              key={idx}
              className="text-[18px] font-semibold text-[#F4F4F5] pt-3 tracking-tight"
            >
              {renderInline(trimmed.replace(/^#\s+/, ""))}
              {isLastBlock && isTyping && (
                <span className="inline-block w-1.5 h-4 ml-1 bg-[#A1A1AA] animate-pulse align-middle" />
              )}
            </h2>
          );
        }

        // Blockquote (clean, no italics)
        if (trimmed.startsWith("> ")) {
          const quoteLines = trimmed
            .split("\n")
            .map((l) => l.replace(/^>\s?/, ""));
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-[#3F3F46] pl-3.5 py-1 text-[#A1A1AA] my-2 bg-[#111114]/40 rounded-r-md"
            >
              {quoteLines.map((line, li) => (
                <p key={li}>{renderInline(line)}</p>
              ))}
            </blockquote>
          );
        }

        // List block (numbered or bullet)
        const lines = trimmed.split("\n");
        const isBulletList = lines.every((l) => /^\s*[-*•]\s+/.test(l));
        const isNumberedList = lines.every((l) => /^\s*\d+\.\s+/.test(l));

        if (isBulletList) {
          return (
            <ul key={idx} className="space-y-1.5 my-2 pl-0.5">
              {lines.map((l, li) => {
                const itemText = l.replace(/^\s*[-*•]\s+/, "");
                return (
                  <li key={li} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#71717A] shrink-0 mt-2 opacity-80" />
                    <span className="flex-1">{renderInline(itemText)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        if (isNumberedList) {
          return (
            <ol key={idx} className="space-y-1.5 my-2 pl-0.5">
              {lines.map((l, li) => {
                const match = l.match(/^\s*(\d+)\.\s+(.*)/);
                const num = match ? match[1] : `${li + 1}`;
                const itemText = match ? match[2] : l;
                return (
                  <li key={li} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs font-medium text-[#71717A] shrink-0 mt-0.5 w-4 text-right">
                      {num}.
                    </span>
                    <span className="flex-1">{renderInline(itemText)}</span>
                  </li>
                );
              })}
            </ol>
          );
        }

        // Regular paragraph with potential soft linebreaks
        const sublines = trimmed.split("\n");
        if (sublines.length > 1) {
          return (
            <p key={idx} className="text-[#D4D4D8]">
              {sublines.map((line, li) => (
                <React.Fragment key={li}>
                  {renderInline(line)}
                  {li < sublines.length - 1 && <br />}
                </React.Fragment>
              ))}
              {isLastBlock && isTyping && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#A1A1AA] animate-pulse align-middle" />
              )}
            </p>
          );
        }

        return (
          <p key={idx} className="text-[#D4D4D8]">
            {renderInline(trimmed)}
            {isLastBlock && isTyping && (
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#A1A1AA] animate-pulse align-middle" />
            )}
          </p>
        );
      })}
    </div>
  );
}
