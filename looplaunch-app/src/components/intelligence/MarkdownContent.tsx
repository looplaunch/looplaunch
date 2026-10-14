"use client";

import React, { useEffect, useState, useMemo } from "react";

interface MarkdownContentProps {
  content: string;
  className?: string;
  animate?: boolean;
}

/**
 * Format inline text styles: bold, italic, code
 */
function renderInline(text: string): React.ReactNode[] {
  // Regex to match **bold**, *italic*, `code`
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="italic text-zinc-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="font-mono text-[12px] bg-zinc-800/80 text-zinc-200 px-1.5 py-0.5 rounded border border-zinc-700/50"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function MarkdownContent({ content, className = "", animate = false }: MarkdownContentProps) {
  const [displayedLength, setDisplayedLength] = useState<number>(animate ? 0 : content.length);

  useEffect(() => {
    if (!animate) {
      setDisplayedLength(content.length);
      return;
    }

    setDisplayedLength(0);
    const totalChars = content.length;
    let current = 0;

    // Smooth typing stream simulation (like Gemini / ChatGPT)
    const interval = setInterval(() => {
      // Stream characters at variable speed (between 3 and 8 chars per tick)
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
    <div className={`space-y-3.5 text-zinc-300 text-[14.5px] leading-[1.68] font-normal ${className}`}>
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        const isLastBlock = idx === blocks.length - 1;

        // Header 3
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={idx} className="text-[15px] font-semibold text-zinc-100 pt-2 tracking-tight">
              {renderInline(trimmed.replace(/^###\s+/, ""))}
              {isLastBlock && isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-zinc-400 animate-pulse align-middle" />}
            </h4>
          );
        }

        // Header 2
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={idx} className="text-[16px] font-semibold text-zinc-100 pt-2.5 tracking-tight">
              {renderInline(trimmed.replace(/^##\s+/, ""))}
              {isLastBlock && isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-zinc-400 animate-pulse align-middle" />}
            </h3>
          );
        }

        // Header 1
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={idx} className="text-[17px] font-semibold text-zinc-50 pt-3 tracking-tight">
              {renderInline(trimmed.replace(/^#\s+/, ""))}
              {isLastBlock && isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-zinc-400 animate-pulse align-middle" />}
            </h2>
          );
        }

        // Blockquote
        if (trimmed.startsWith("> ")) {
          const quoteLines = trimmed.split("\n").map(l => l.replace(/^>\s?/, ""));
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-zinc-600 pl-3.5 italic text-zinc-400 my-2"
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
            <ul key={idx} className="space-y-1.5 my-2 pl-1">
              {lines.map((l, li) => {
                const itemText = l.replace(/^\s*[-*•]\s+/, "");
                return (
                  <li key={li} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0 mt-2.5 opacity-70" />
                    <span className="flex-1">{renderInline(itemText)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }

        if (isNumberedList) {
          return (
            <ol key={idx} className="space-y-1.5 my-2 pl-1">
              {lines.map((l, li) => {
                const match = l.match(/^\s*(\d+)\.\s+(.*)/);
                const num = match ? match[1] : `${li + 1}`;
                const itemText = match ? match[2] : l;
                return (
                  <li key={li} className="flex items-start gap-2.5">
                    <span className="font-mono text-xs font-semibold text-zinc-400 shrink-0 mt-0.5 w-4 text-right">
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
            <p key={idx} className="text-zinc-200">
              {sublines.map((line, li) => (
                <React.Fragment key={li}>
                  {renderInline(line)}
                  {li < sublines.length - 1 && <br />}
                </React.Fragment>
              ))}
              {isLastBlock && isTyping && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-zinc-300 animate-pulse align-middle" />
              )}
            </p>
          );
        }

        return (
          <p key={idx} className="text-zinc-200">
            {renderInline(trimmed)}
            {isLastBlock && isTyping && (
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-zinc-300 animate-pulse align-middle" />
            )}
          </p>
        );
      })}
    </div>
  );
}
