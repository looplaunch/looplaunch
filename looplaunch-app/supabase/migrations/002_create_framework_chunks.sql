-- ══════════════════════════════════════════════════════════════
-- Loop Launch — Framework Chunks Table (Vector Search / RAG)
-- ══════════════════════════════════════════════════════════════
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/lzuzkvxodxdgeclboyvp/sql/new
-- ══════════════════════════════════════════════════════════════

-- 1. Enable pgvector extension (required for vector embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Framework chunks table
-- Stores parsed sections of Loop Launch framework docs with vector embeddings.
CREATE TABLE IF NOT EXISTS framework_chunks (
  id              SERIAL PRIMARY KEY,
  doc_name        TEXT NOT NULL,               -- e.g. "Loop_Launch_SaaS_Framework.pdf"
  section         TEXT,                        -- e.g. "Chapter 3: Retention Loops"
  chunk_index     INTEGER NOT NULL DEFAULT 0,  -- Order within the document
  content         TEXT NOT NULL,               -- The actual text content of this chunk
  embedding       vector(768),                 -- Gemini gemini-embedding-001 (768-dim)
  metadata        JSONB DEFAULT '{}'::jsonb,   -- Extra metadata (industry, page, stage, etc.)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. HNSW Index for ultra-fast vector similarity search
-- HNSW works smoothly on empty tables and provides high-speed cosine recall
CREATE INDEX IF NOT EXISTS idx_framework_chunks_embedding
  ON framework_chunks
  USING hnsw (embedding vector_cosine_ops);

-- 4. B-Tree index for filtering by document
CREATE INDEX IF NOT EXISTS idx_framework_chunks_doc_name
  ON framework_chunks (doc_name);

-- 5. GIN index for JSONB metadata queries (e.g. industry filtering)
CREATE INDEX IF NOT EXISTS idx_framework_chunks_metadata
  ON framework_chunks USING gin (metadata);

-- 6. Disable RLS (queries are made server-side via service_role key)
ALTER TABLE framework_chunks DISABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────
-- 7. Vector similarity search function (RPC)
-- ──────────────────────────────────────────────
-- Called from Supabase client:
-- supabase.rpc('match_framework_chunks', {
--   query_embedding: [...],
--   match_count: 5,
--   match_threshold: 0.3,
--   filter_industry: 'SaaS'
-- })
CREATE OR REPLACE FUNCTION match_framework_chunks(
  query_embedding vector(768),
  match_count     INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.3,
  filter_industry TEXT DEFAULT NULL
)
RETURNS TABLE (
  id          INT,
  doc_name    TEXT,
  section     TEXT,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id,
    fc.doc_name,
    fc.section,
    fc.content,
    fc.metadata,
    (1 - (fc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM framework_chunks fc
  WHERE (1 - (fc.embedding <=> query_embedding)) > match_threshold
    AND (
      filter_industry IS NULL
      OR fc.metadata->>'industry' IS NULL
      OR LOWER(fc.metadata->>'industry') = LOWER(filter_industry)
      OR LOWER(filter_industry) LIKE '%' || LOWER(fc.metadata->>'industry') || '%'
      OR LOWER(fc.metadata->>'industry') LIKE '%' || LOWER(filter_industry) || '%'
      OR LOWER(fc.metadata->>'industry') = 'general'
      OR LOWER(fc.metadata->>'industry') = 'neuromarketing'
      OR LOWER(fc.metadata->>'industry') = 'all'
    )
  ORDER BY fc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
