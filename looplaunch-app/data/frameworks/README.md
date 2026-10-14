# Loop Launch Framework Documents

Drop your PDF (`.pdf`), Word (`.docx`), Markdown (`.md`), or Text (`.txt`) framework documents into this folder.

### Supported Structure
You can organize by industry subfolders or keep them in the root:

```
data/frameworks/
├── SaaS/
│   ├── Loop_Launch_SaaS_Framework.pdf
│   └── PLG_Retention_Loops.docx
├── Fintech/
│   └── Loop_Launch_Fintech_Playbook.pdf
├── ECommerce/
│   └── Loop_Launch_ECommerce_Strategy.docx
└── General/
    └── Core_Strategic_Principles.pdf
```

### Ingestion Command
Once your files are placed in this folder, run:

```bash
npm run ingest:frameworks
```

This will automatically:
1. Parse all text from your PDFs and DOCXs
2. Slice them into clean semantic chunks
3. Generate 768-dimensional AI embeddings using Google Gemini
4. Store them in Supabase (`framework_chunks` table) with pgvector indexing

Whenever a user asks a strategic question, Loop Launch retrieves the most relevant passages from these framework documents before generating the final advice.
