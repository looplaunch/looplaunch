# Framework RAG & Document Ingestion SOP

## Purpose
Enables Loop Launch to ground all AI-generated strategic advice in proprietary Loop Launch industry frameworks (PDF, DOCX, TXT) using Retrieval-Augmented Generation (RAG).

## Architecture (3-Layer)
- **Layer 1: Directive** (This document)
- **Layer 2: Orchestration** (Next.js `/api/intelligence/ask` route + `src/lib/ai/framework-retriever.ts`)
- **Layer 3: Execution** (`scripts/ingest-frameworks.ts` + Supabase `pgvector` table `framework_chunks`)

## Inputs
- PDF documents (`.pdf`), Word documents (`.docx`), Markdown/Text (`.md`, `.txt`) located in `data/frameworks/`
- Google Drive folder exports
- User query + company industry context

## Database Schema (Supabase)
Migration: `supabase/migrations/002_create_framework_chunks.sql`
- Table: `framework_chunks`
  - `id`: SERIAL PRIMARY KEY
  - `doc_name`: TEXT
  - `section`: TEXT
  - `chunk_index`: INT
  - `content`: TEXT
  - `embedding`: vector(768) (Cosine distance via pgvector HNSW index)
  - `metadata`: JSONB (industry, fileName, etc.)
- RPC Function: `match_framework_chunks(query_embedding, match_count, match_threshold, filter_industry)`

## Execution Steps
1. **Migration**:
   Run `supabase/migrations/002_create_framework_chunks.sql` in the Supabase SQL Editor.
2. **Document Placement**:
   Place PDF or DOCX framework files in `data/frameworks/` (or industry subfolders like `data/frameworks/SaaS/`).
3. **Ingestion**:
   Run:
   ```bash
   npm run ingest:frameworks
   ```
4. **Query-time Retrieval**:
   At runtime in `/api/intelligence/ask`, `retrieveFrameworkContext(question, industry)`:
   - Generates 768-dim embedding via Gemini (`gemini-embedding-001` with `outputDimensionality: 768`)
   - Calls Supabase `match_framework_chunks` RPC
   - Injects matching chunks into `buildConversationalAdvisorPrompt`

## Key Edge Cases & Learnings
1. **Google Drive Private Sharing**: Direct URL scraping of Google Drive folders returns HTTP 401 / Sign-in redirects unless the folder is shared as "Anyone with the link can view". Direct download to `data/frameworks/` is the most reliable approach.
2. **Gemini Embedding Dimensions**: Gemini `gemini-embedding-001` defaults to 3072 dimensions, but accepts `outputDimensionality: 768`. Setting 768 allows efficient HNSW indexing in pgvector.
3. **Idempotent Ingestion**: Re-running `ingest:frameworks` deletes existing chunks for matching `doc_name` before re-inserting to prevent duplicate search results.
