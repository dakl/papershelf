# PaperShelf — Complete Build Spec

## What is this?
A native-feeling Mac desktop app for searching arXiv, organizing research papers, annotating PDFs, and chatting with your paper library using RAG.

**Stack:** Electron + React 18 + TypeScript + Tailwind CSS + SQLite (better-sqlite3) + pdf.js + Vercel AI SDK (multi-provider: Anthropic, OpenAI, Google, Ollama)

---

## Design: macOS Native Look & Feel

The app must look and feel like a native macOS app, not a website in a window.

- `titleBarStyle: 'hiddenInset'` with traffic light controls at `{ x: 16, y: 16 }`
- `vibrancy: 'sidebar'` on the BrowserWindow
- System font: `-apple-system, BlinkMacSystemFont, SF Pro Text`
- macOS font sizes: 11px (small/labels), 13px (body), 14px (emphasis), 16px (headings)
- Follow system dark mode (`prefers-color-scheme`)
- Subtle shadows matching macOS (`0 0 0 0.5px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)`)
- macOS-style separator lines (`rgba(0,0,0,0.1)`)
- Selection highlight color: `rgba(0, 122, 255, 0.15)`
- Sidebar should feel translucent/vibrancy-backed
- Keyboard shortcuts use ⌘ (Cmd), not Ctrl

Reference apps for visual quality: **Linear, Notion, Obsidian, Raycast** — all Electron, all feel native enough.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│ Electron Main Process                            │
│  ├── SQLite DB (metadata + FTS5 + chunks)        │
│  ├── ArXiv API client                            │
│  ├── PDF download + text extraction (pdf-parse)  │
│  ├── Chunking pipeline                           │
│  ├── LLM client (Vercel AI SDK, multi-provider)  │
│  └── File system (PDF storage)                   │
├──────────────────────────────────────────────────┤
│ Preload (contextBridge IPC)                      │
├──────────────────────────────────────────────────┤
│ Renderer Process (React + Tailwind)              │
│  ├── Sidebar (library, collections, tags)        │
│  ├── Paper list (sortable, searchable)           │
│  ├── PDF viewer (pdf.js + annotation layer)      │
│  └── Chat panel (RAG interface, streaming)       │
└──────────────────────────────────────────────────┘
```

---

## Data Model (SQLite)

```sql
CREATE TABLE papers (
  id TEXT PRIMARY KEY,              -- arXiv ID (e.g. "2401.12345")
  title TEXT NOT NULL,
  authors TEXT NOT NULL,             -- JSON array of strings
  abstract TEXT,
  published_date TEXT,
  updated_date TEXT,
  categories TEXT,                   -- JSON array
  arxiv_url TEXT,
  pdf_path TEXT,                     -- local filesystem path to downloaded PDF
  full_text TEXT,                    -- extracted full text for FTS
  is_favorite INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE paper_collections (
  paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
  collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, collection_id)
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT
);

CREATE TABLE paper_tags (
  paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (paper_id, tag_id)
);

CREATE TABLE annotations (
  id TEXT PRIMARY KEY,               -- UUID
  paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'highlight',  -- 'highlight' | 'comment' | 'area'
  page_number INTEGER NOT NULL,
  color TEXT DEFAULT '#FFEB3B',
  rects TEXT,                        -- JSON array of {x, y, width, height, pageIndex} in PDF coords
  selected_text TEXT,
  comment TEXT,
  area_rect TEXT,                    -- JSON {x, y, width, height} for area annotations
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_annotations_paper ON annotations(paper_id);
CREATE INDEX idx_annotations_page ON annotations(paper_id, page_number);

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  content TEXT,
  embedding BLOB,                    -- serialized float32 array (for future vector search)
  page_number INTEGER,
  source TEXT DEFAULT 'extraction',  -- 'extraction' or 'highlight'
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_chunks_paper ON chunks(paper_id);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Full-text search
CREATE VIRTUAL TABLE papers_fts USING fts5(title, abstract, full_text, content=papers, content_rowid=rowid);
CREATE VIRTUAL TABLE annotations_fts USING fts5(selected_text, comment, content=annotations, content_rowid=rowid);
```

---

## Feature Specs

### 1. ArXiv Search

**API:** `https://export.arxiv.org/api/query` (REST, no auth, returns Atom XML)

- Search bar in the top area (⌘K to focus)
- Query params: `search_query=all:{term}`, `start=0`, `max_results=20`
- Parse XML response → extract: id, title, authors, abstract, published, updated, categories, pdf link
- Display results as a list: title, authors (truncated), abstract snippet, date, category badges
- Each result has a "Save to Library" button that:
  1. Inserts paper metadata into SQLite
  2. Downloads the PDF to `{userData}/papers/{arxiv_id}.pdf`
  3. Extracts full text via pdf-parse
  4. Chunks the text and stores in chunks table
- Show a badge/indicator if a search result is already in the library

### 2. Paper Library

**Sidebar (left panel, ~220px wide):**
- Drag region at top for titlebar (38px tall, accounts for traffic lights)
- Sections:
  - 🔍 Search (global full-text search via FTS5)
  - 📄 All Papers (count badge)
  - ⭐ Favorites
  - 🕐 Recently Added
  - **Collections** header with ➕ button
    - Each collection with name, color dot, paper count
  - **Tags** header with ➕ button
    - Each tag with name, color dot

**Paper list (center panel):**
- Shows papers for current sidebar selection
- Each paper row: title, authors (truncated), date, category badges, ⭐ toggle, annotation count badge
- Sortable by: date added, published date, title, author
- Right-click context menu: Open PDF, Add to Collection, Tag, Copy arXiv URL, Delete

**Paper detail / PDF viewer (right panel):**
- Header: full title, authors (clickable → arXiv search), date, categories, abstract
- Tabs or toggle: Metadata | PDF Reader | Chat
- Favorite toggle, "Open on arXiv" link

### 3. PDF Viewer with Annotations

**Rendering:** Use pdf.js (`pdfjs-dist` npm package) to render pages into canvas elements.

**Viewer controls toolbar:**
```
[← →] Page N of M  |  [- zoom +]  |  [highlight mode 🖍]  |  [color: ● ● ● ● ●]  |  [📝 annotations panel]
```

**Highlight annotations:**
1. User toggles highlight mode (toolbar button or ⌘H)
2. User selects text by clicking and dragging on the pdf.js text layer
3. On mouseup, get the Selection/Range from the text layer spans
4. Map browser client rects to PDF coordinate space using `page.getViewport()` inverse transform
5. Store rects in PDF coordinates (so they survive zoom changes)
6. Render highlight overlays as absolutely-positioned `<div>` elements with `mix-blend-mode: multiply` and the selected color at ~40% opacity
7. Highlight is immediately saved to SQLite
8. Clicking a highlight shows a small popover: [💬 Add comment] [🎨 Change color] [🗑 Delete]

**Color palette:** yellow (#FFEB3B), green (#66BB6A), blue (#42A5F5), pink (#F48FB1), orange (#FFA726)

**Comments:**
- Clicking "Add comment" on a highlight opens a popover/inline textarea
- Save on blur or ⌘Enter
- Comments are stored in the annotations table alongside the highlight

**Annotation side panel (⌘⇧A):**
- Right-side panel listing all annotations for current paper
- Grouped by page number
- Each entry shows: color dot, highlighted text snippet (truncated), comment preview
- Click an entry → scrolls PDF to that page and flashes the highlight
- Delete button per annotation

**Coordinate system — this is the hardest part:**
- pdf.js renders with a viewport transform. Page coordinates ≠ screen pixels.
- When capturing a highlight: get client rects from the text layer Selection, then convert to PDF page coordinates using the inverse of `page.getViewport({ scale }).transform`
- When rendering highlights: convert stored PDF coordinates back to screen coordinates using the current viewport transform
- This ensures highlights stay correctly positioned at any zoom level

**RAG integration:**
- When a highlight is created, also save the selected text as a chunk with `source: 'highlight'`
- In RAG retrieval, boost highlight-sourced chunks by 1.5x score
- Include the user's comments as additional context in the prompt

### 4. RAG Chat

**Chat panel:** Can be a slide-out right panel or a tab within the paper detail view.

**Scope selector** at top of chat:
- "This paper" — queries chunks for the currently viewed paper
- "Collection: {name}" — queries chunks for all papers in a collection
- "Entire library" — queries all chunks

**RAG pipeline (main process):**
1. **Chunking** (on paper save): Split extracted full text into ~512 token chunks with ~50 token overlap. Track page numbers per chunk where possible.
2. **Retrieval** (on chat query): For v0.1, use FTS5 keyword search across chunks as the retrieval method. This avoids needing embeddings/vectors initially and still works well for technical papers. Query the chunks table filtered by scope.
3. **Generation**: Build a prompt with retrieved chunks as context, send to the user's configured LLM provider via Vercel AI SDK `streamText()`, stream the response back to the renderer. Default model: `anthropic/claude-sonnet-4-5-20250929`. Supported providers: Anthropic (`@ai-sdk/anthropic`), OpenAI (`@ai-sdk/openai`), Google (`@ai-sdk/google`), Ollama via OpenAI-compatible endpoint.
4. **Citations**: Include paper title + page number for each chunk used. Display as clickable links that navigate to the source.

**Prompt template:**
```
You are a research assistant helping analyze academic papers. Answer the user's question based on the provided paper excerpts. Cite specific papers and sections when possible.

Context from papers:
---
[Paper: {title}] (Page {page})
{chunk_content}
---
[Paper: {title}] (Page {page})
{chunk_content}
---

User question: {message}
```

**Chat UI:**
- Message list with user/assistant bubbles
- Streaming response display
- Citations shown as small cards below assistant messages (clickable → opens paper at page)
- Input box with send button and scope indicator
- ⌘Enter to send

**Future (v0.2+):** Replace FTS5 retrieval with proper vector embeddings (via Ollama local embeddings or provider embedding APIs) and cosine similarity search. The chunk storage schema already supports this with the embedding BLOB column.

### 5. Settings

Accessible via ⌘, (Preferences):
- **LLM Provider** — dropdown: Anthropic, OpenAI, Google, Ollama (local)
- **Model** — text field or dropdown populated per provider (e.g. `claude-sonnet-4-5-20250929`, `gpt-4o`, `gemini-2.0-flash`, `llama3`)
- **API Key** — stored securely (use `safeStorage` from Electron); not needed for Ollama
- **Ollama endpoint** — shown when Ollama is selected (default: `http://localhost:11434`)
- **PDF storage location** — defaults to `{userData}/papers/`
- **Theme** — Light / Dark / System

---

## File Structure

```
papershelf/
├── package.json
├── tsconfig.main.json           # Main process TS config
├── tsconfig.json                # Renderer TS config
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── electron-builder.yml
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App entry, window creation
│   │   ├── preload.ts           # Context bridge for IPC
│   │   ├── database.ts          # SQLite setup + all queries
│   │   ├── ipc-handlers.ts      # IPC handler registration
│   │   ├── arxiv-client.ts      # ArXiv API search
│   │   ├── pdf-processor.ts     # Download PDF, extract text, chunk
│   │   ├── rag-pipeline.ts      # Retrieve chunks + build prompt + call LLM
│   │   └── llm-client.ts        # Vercel AI SDK wrapper (multi-provider, streaming)
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx             # React entry
│   │   ├── App.tsx              # Root layout (3-panel)
│   │   ├── components/
│   │   │   ├── Sidebar.tsx              # Library sidebar
│   │   │   ├── PaperList.tsx            # Paper list view
│   │   │   ├── PaperListItem.tsx        # Individual paper row
│   │   │   ├── PaperDetail.tsx          # Paper metadata + tabs
│   │   │   ├── SearchBar.tsx            # ArXiv search interface
│   │   │   ├── SearchResults.tsx        # ArXiv search results
│   │   │   ├── PDFViewer.tsx            # pdf.js renderer
│   │   │   ├── AnnotationLayer.tsx      # Highlight overlay rendering
│   │   │   ├── AnnotationToolbar.tsx    # Highlight mode, color picker
│   │   │   ├── AnnotationSidePanel.tsx  # List of annotations per paper
│   │   │   ├── CommentPopover.tsx       # Inline comment editor
│   │   │   ├── ColorPicker.tsx          # Highlight color selection
│   │   │   ├── ChatPanel.tsx            # RAG chat interface
│   │   │   ├── ChatMessage.tsx          # Single chat message bubble
│   │   │   ├── ChatCitation.tsx         # Citation card
│   │   │   ├── CollectionManager.tsx    # Create/edit collections
│   │   │   ├── TagManager.tsx           # Create/edit tags
│   │   │   └── SettingsModal.tsx        # Preferences dialog
│   │   ├── hooks/
│   │   │   ├── usePapers.ts
│   │   │   ├── useSearch.ts
│   │   │   ├── useAnnotations.ts
│   │   │   ├── useChat.ts
│   │   │   └── useCollections.ts
│   │   ├── stores/              # Zustand state management
│   │   │   ├── paperStore.ts
│   │   │   ├── uiStore.ts
│   │   │   ├── annotationStore.ts
│   │   │   └── chatStore.ts
│   │   └── styles/
│   │       └── globals.css      # Tailwind base + macOS overrides
│   └── shared/
│       └── types.ts             # TypeScript types shared between main/renderer
└── resources/
    └── icon.icns                # App icon
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘K | Focus search / ArXiv search |
| ⌘N | New collection |
| ⌘H | Toggle highlight mode |
| ⌘⇧A | Toggle annotation side panel |
| ⌘, | Open settings |
| ⌘Enter | Send chat message / Save comment |
| ⌘⇧C | Toggle chat panel |
| ⌘F | Search within PDF (browser find) |
| ⌘+/⌘- | Zoom PDF |
| Escape | Exit highlight mode / Close modals |
| Delete | Delete selected annotation |
| ⌘⌫ | Delete selected paper (with confirmation) |

---

## Build Order (iterate in this sequence)

### Phase 1: Shell & Search
1. Scaffold Electron + React + Vite + Tailwind project
2. Get the window rendering with macOS native feel (vibrancy, traffic lights, titlebar)
3. Implement the 3-panel layout (sidebar | list | detail)
4. Build ArXiv search client and search UI
5. Display search results

### Phase 2: Library
6. SQLite database setup with schema
7. Save papers from search results to library
8. Download PDFs on save
9. Paper list view with sidebar navigation
10. Collections and tags CRUD
11. Full-text search via FTS5

### Phase 3: PDF Viewer
12. Integrate pdf.js for PDF rendering
13. Viewer controls (zoom, page navigation)
14. Text layer rendering (needed for selection)

### Phase 4: Annotations
15. Highlight mode — text selection → capture rects in PDF coordinates
16. Render highlight overlays with mix-blend-mode: multiply
17. Persist highlights to SQLite
18. Comment popover on highlight click
19. Annotation side panel (list all highlights per paper)
20. Color picker
21. FTS on annotations

### Phase 5: RAG Chat
22. Text extraction + chunking pipeline on paper save
23. FTS5-based chunk retrieval
24. Vercel AI SDK streaming integration (multi-provider)
25. Chat UI with scope selector
26. Citation display with clickable links to source
27. Highlight-boosted retrieval (highlight chunks weighted 1.5x)

### Phase 6: Polish
28. Settings/preferences modal
29. All keyboard shortcuts
30. Error handling and loading states
31. Smooth animations and transitions
32. Empty states (no papers yet, no search results, etc.)
33. App packaging with electron-builder

---

## Dependencies

```json
{
  "dependencies": {
    "ai": "^4.0.0",
    "@ai-sdk/anthropic": "^1.0.0",
    "@ai-sdk/openai": "^1.0.0",
    "@ai-sdk/google": "^1.0.0",
    "better-sqlite3": "^11.0.0",
    "pdf-parse": "^1.1.1",
    "pdfjs-dist": "^4.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/pdf-parse": "^1.1.4",
    "@types/uuid": "^9.0.7",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.17",
    "concurrently": "^8.2.2",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.1",
    "electron-rebuild": "^3.2.9",
    "postcss": "^8.4.33",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.12",
    "zustand": "^4.5.0"
  }
}
```

---

## Notes for Claude Code

- **Start with Phase 1 only.** Get the Electron app launching with the 3-panel layout and ArXiv search before moving on. Don't try to build everything at once.
- **better-sqlite3 requires native compilation.** After `npm install`, run `npx electron-rebuild` to rebuild it against Electron's Node version.
- **pdf.js coordinate system** is the trickiest part. When implementing annotations, store all rects in PDF coordinate space (not screen pixels). Use `page.getViewport({ scale })` to convert between coordinate systems. The inverse transform is needed when capturing highlights from browser Selection rects.
- **For the RAG pipeline v0.1**, use FTS5 keyword search for retrieval instead of vector embeddings. This is simpler, requires no embedding model, and works surprisingly well for technical text. Vector search can be added later.
- **Streaming LLM responses**: Use Vercel AI SDK's `streamText()` with the user's configured provider. Forward text deltas to the renderer via IPC `webContents.send()`. The provider is resolved at runtime from settings (e.g. `createAnthropic()`, `createOpenAI()`, `createGoogleGenerativeAI()`). For Ollama, use `createOpenAI({ baseURL: ollamaEndpoint + '/v1' })`.
- **PDF text layer**: pdf.js has a `textLayer` option that renders invisible `<span>` elements over the canvas. This is what enables text selection for highlights. Make sure `textLayer` is enabled in the viewer.

