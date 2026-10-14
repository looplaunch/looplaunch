/**
 * Loop Launch — Framework Document Ingestion Pipeline
 *
 * Reads PDF, DOCX, TXT, and Markdown framework files, chunks the content,
 * generates 768-dim Gemini embeddings, and stores them in Supabase (pgvector).
 *
 * Usage:
 *   npx tsx scripts/ingest-frameworks.ts [directory-path]
 *   npm run ingest:frameworks
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import mammoth from "mammoth";

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

if (!GEMINI_KEY) {
  console.error("❌ Error: Missing GEMINI_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// ──────────────────────────────────────────────
// Document Parsers
// ──────────────────────────────────────────────

async function parsePdf(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new (PDFParse as any)({ data: buffer });
    await parser.load();
    const result = await parser.getText();
    await parser.destroy();

    if (typeof result === "string") return result;
    if (result && typeof result === "object" && "text" in result) {
      return (result as any).text;
    }
    return String(result || "");
  } catch (err: any) {
    console.warn(`[WARN] Standard PDF parse failed for ${path.basename(filePath)}: ${err.message}. Using text fallback.`);
    return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
  }
}

async function parseDocx(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value || "";
}

async function parseDocument(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") {
    return parsePdf(filePath);
  } else if (ext === ".docx") {
    return parseDocx(filePath);
  } else if (ext === ".txt" || ext === ".md") {
    return fs.readFileSync(filePath, "utf-8");
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

// ──────────────────────────────────────────────
// Chunking Strategy
// ──────────────────────────────────────────────

interface Chunk {
  text: string;
  section: string | null;
  chunkIndex: number;
}

function chunkText(text: string, chunkSize = 1000, overlap = 150): Chunk[] {
  // Clean whitespace
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\n+/);
  const chunks: Chunk[] = [];
  let currentChunk = "";
  let currentSection: string | null = null;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Detect if this paragraph looks like a heading
    if (
      (trimmed.length < 80 && (trimmed.startsWith("#") || /^[A-Z0-9\s:—–-]+$/.test(trimmed) || /^(Chapter|Section|Part|Module)\s+\d+/i.test(trimmed)))
    ) {
      currentSection = trimmed.replace(/^#+\s*/, "");
    }

    if (currentChunk.length + trimmed.length <= chunkSize) {
      currentChunk += (currentChunk ? "\n\n" : "") + trimmed;
    } else {
      if (currentChunk) {
        chunks.push({
          text: currentChunk,
          section: currentSection,
          chunkIndex: chunkIndex++,
        });
        // Keep overlap from end of current chunk
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + "\n\n" + trimmed;
      } else {
        // Single paragraph larger than chunkSize -> hard chunk
        let start = 0;
        while (start < trimmed.length) {
          const slice = trimmed.slice(start, start + chunkSize);
          chunks.push({
            text: slice,
            section: currentSection,
            chunkIndex: chunkIndex++,
          });
          start += chunkSize - overlap;
        }
        currentChunk = "";
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      text: currentChunk.trim(),
      section: currentSection,
      chunkIndex: chunkIndex++,
    });
  }

  return chunks;
}

// ──────────────────────────────────────────────
// Industry & Metadata Detection
// ──────────────────────────────────────────────

function inferIndustry(filePath: string): string {
  const lower = filePath.toLowerCase();

  if (lower.includes("beauty") || lower.includes("skincare") || lower.includes("cosmetic")) {
    return "beauty";
  }
  if (lower.includes("fashion") || lower.includes("apparel") || lower.includes("clothing")) {
    return "fashion";
  }
  if (lower.includes("cce") || lower.includes("electronics") || lower.includes("gadget")) {
    return "cce";
  }
  if (lower.includes("fnb") || lower.includes("food") || lower.includes("beverage")) {
    return "fnb";
  }
  if (lower.includes("hfw") || lower.includes("fitness") || lower.includes("wellness") || lower.includes("health")) {
    return "hfw";
  }
  if (lower.includes("neuro") || lower.includes("psychology") || lower.includes("consumer-decision")) {
    return "neuromarketing";
  }
  if (lower.includes("saas") || lower.includes("software") || lower.includes("cloud")) {
    return "saas";
  }
  if (lower.includes("fintech") || lower.includes("finance") || lower.includes("banking")) {
    return "fintech";
  }
  if (lower.includes("ecommerce") || lower.includes("e-commerce") || lower.includes("d2c") || lower.includes("retail")) {
    return "ecommerce";
  }

  return "general";
}

// ──────────────────────────────────────────────
// Embedding Generator
// ──────────────────────────────────────────────

async function getEmbeddingWithRetry(text: string, retries = 3): Promise<number[]> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await embeddingModel.embedContent({
        content: { role: "user", parts: [{ text: text.slice(0, 8000) }] },
        outputDimensionality: 768,
      } as any);
      return res.embedding.values;
    } catch (err: any) {
      if (attempt === retries) throw err;
      console.warn(`[RETRY] Embedding call failed (attempt ${attempt}/${retries}): ${err.message}. Retrying in 1s...`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error("Failed to get embedding after retries");
}

// ──────────────────────────────────────────────
// Main Ingestion Flow
// ──────────────────────────────────────────────

function findFrameworkFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(findFrameworkFiles(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (
        [".pdf", ".docx", ".txt", ".md"].includes(ext) &&
        !entry.name.startsWith(".") &&
        !entry.name.toLowerCase().startsWith("readme")
      ) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

async function ingest() {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("🚀 LOOP LAUNCH FRAMEWORK INGESTION PIPELINE (RAG)");
  console.log("══════════════════════════════════════════════════════════════════\n");

  const targetDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), "data/frameworks");

  console.log(`📂 Scanning directory: ${targetDir}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`✨ Created directory: ${targetDir}`);
    console.log(`ℹ️ Place your PDF and DOCX framework documents into this folder, then run this script again.`);
    return;
  }

  const files = findFrameworkFiles(targetDir);
  if (files.length === 0) {
    console.log(`⚠️ No PDF, DOCX, TXT, or MD files found in ${targetDir}`);
    console.log(`💡 Copy your Loop Launch framework documents into: ${targetDir}`);
    console.log(`   and run: npm run ingest:frameworks\n`);
    return;
  }

  console.log(`📑 Found ${files.length} document(s) to process:\n`);
  files.forEach((f, i) => console.log(`   ${i + 1}. ${path.relative(process.cwd(), f)}`));
  console.log("");

  let totalChunksIngested = 0;

  for (const file of files) {
    const docName = path.basename(file);
    const industry = inferIndustry(file);
    console.log(`\n──────────────────────────────────────────────────────────────`);
    console.log(`📄 Processing: ${docName}`);
    console.log(`🏷️ Inferred Industry: ${industry.toUpperCase()}`);

    try {
      const text = await parseDocument(file);
      console.log(`   Length: ${text.length} characters extracted`);

      if (text.length < 50) {
        console.warn(`   ⚠️ File seems empty or could not be parsed. Skipping.`);
        continue;
      }

      const chunks = chunkText(text, 1000, 150);
      console.log(`   Generated ${chunks.length} semantic chunks`);

      // 1. Delete previous chunks for this document (idempotent re-run)
      const { error: deleteErr } = await supabase
        .from("framework_chunks")
        .delete()
        .eq("doc_name", docName);

      if (deleteErr) {
        console.warn(`   Notice while clearing old chunks: ${deleteErr.message}`);
      }

      // 2. Generate embeddings and prepare rows
      console.log(`   Generating 768-dim vector embeddings via Gemini...`);
      const rows: any[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        process.stdout.write(`   Embedding chunk ${i + 1}/${chunks.length}...\r`);
        const embedding = await getEmbeddingWithRetry(c.text);

        rows.push({
          doc_name: docName,
          section: c.section,
          chunk_index: c.chunkIndex,
          content: c.text,
          embedding: embedding,
          metadata: {
            industry,
            fileName: docName,
            chunkTotal: chunks.length,
          },
        });

        // Small delay to prevent API rate limit bursts
        await new Promise((r) => setTimeout(r, 120));
      }
      console.log(`\n   ✅ Embeddings generated for all ${chunks.length} chunks.`);

      // 3. Insert into Supabase in batches of 25
      console.log(`   Saving chunks to Supabase framework_chunks table...`);
      const batchSize = 25;
      for (let b = 0; b < rows.length; b += batchSize) {
        const batch = rows.slice(b, b + batchSize);
        const { error: insertErr } = await supabase
          .from("framework_chunks")
          .insert(batch);

        if (insertErr) {
          throw new Error(`Supabase insert failed: ${insertErr.message}`);
        }
      }

      console.log(`   🎉 Successfully ingested ${chunks.length} chunks from ${docName}!`);
      totalChunksIngested += chunks.length;
    } catch (err: any) {
      console.error(`   ❌ Error processing ${docName}:`, err.message);
    }
  }

  console.log(`\n══════════════════════════════════════════════════════════════════`);
  console.log(`✅ INGESTION COMPLETE!`);
  console.log(`   Total chunks indexed in Supabase: ${totalChunksIngested}`);
  console.log(`   The AI will now retrieve from these framework documents before answering.`);
  console.log(`══════════════════════════════════════════════════════════════════\n`);
}

ingest().catch((err) => {
  console.error("Fatal ingestion error:", err);
  process.exit(1);
});
