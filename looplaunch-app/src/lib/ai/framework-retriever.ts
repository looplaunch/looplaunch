/**
 * Framework Retriever (RAG Pipeline for Loop Launch Proprietary Frameworks)
 *
 * 1. Generates 768-dim embeddings for questions using Gemini
 * 2. Performs vector cosine similarity search in Supabase (pgvector)
 * 3. Returns relevant framework passages to ground AI reasoning
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabase } from "@/lib/db/supabase";

export interface FrameworkChunkMatch {
  id: number;
  doc_name: string;
  section: string | null;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}

export interface FrameworkRetrievalResult {
  matches: FrameworkChunkMatch[];
  formattedContext: string;
  used: boolean;
}

// ──────────────────────────────────────────────
// Embeddings Generator (Gemini)
// ──────────────────────────────────────────────

let genAI: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Generate a 768-dimension vector embedding for input text.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getGeminiClient();
  if (!client) {
    console.warn("[RAG] GEMINI_API_KEY not configured — skipping embedding generation");
    return null;
  }

  try {
    const model = client.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent({
      content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
      outputDimensionality: 768,
    } as any);

    if (result.embedding && result.embedding.values) {
      return result.embedding.values;
    }
    return null;
  } catch (error: any) {
    console.warn("[RAG] Failed to generate embedding:", error?.message || error);
    return null;
  }
}

/**
 * Retrieve framework knowledge relevant to a question and optional industry.
 */
export async function retrieveFrameworkContext(
  question: string,
  industry?: string,
  options?: {
    matchCount?: number;
    matchThreshold?: number;
  }
): Promise<FrameworkRetrievalResult> {
  const matchCount = options?.matchCount ?? 4;
  const matchThreshold = options?.matchThreshold ?? 0.35;

  const emptyResult: FrameworkRetrievalResult = {
    matches: [],
    formattedContext: "",
    used: false,
  };

  try {
    // 1. Generate embedding for user query
    const embedding = await generateEmbedding(question);
    if (!embedding || embedding.length === 0) {
      return emptyResult;
    }

    // 2. Query Supabase pgvector RPC
    const supabase = getSupabase();
    if (!supabase) {
      return emptyResult;
    }

    const { data, error } = await supabase.rpc("match_framework_chunks", {
      query_embedding: embedding,
      match_count: matchCount,
      match_threshold: matchThreshold,
      filter_industry: industry || null,
    });

    if (error) {
      // Table or function might not be migrated yet
      console.warn("[RAG] Supabase match_framework_chunks query notice:", error.message);
      return emptyResult;
    }

    const matches: FrameworkChunkMatch[] = (data || []) as FrameworkChunkMatch[];

    if (matches.length === 0) {
      console.log(`[RAG] No framework chunks matched threshold (${matchThreshold})`);
      return emptyResult;
    }

    console.log(`[RAG] Retrieved ${matches.length} framework chunk(s) for query: "${question.slice(0, 50)}..."`);

    // 3. Format into structured markdown context for the prompt
    const formattedContext = matches
      .map((m, i) => {
        const docTitle = m.doc_name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        const sectionHeader = m.section ? ` > ${m.section}` : "";
        const simPercent = Math.round(m.similarity * 100);
        return `[Framework Ref ${i + 1}] (${docTitle}${sectionHeader} | Relevance: ${simPercent}%)\n${m.content.trim()}`;
      })
      .join("\n\n---\n\n");

    return {
      matches,
      formattedContext,
      used: true,
    };
  } catch (err: any) {
    console.error("[RAG] Unexpected error during framework retrieval:", err?.message || err);
    return emptyResult;
  }
}
