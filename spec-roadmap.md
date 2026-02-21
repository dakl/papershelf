# PaperShelf — Roadmap

## Current State

**Phase 2 complete:** Electron + React desktop app with arXiv search, SQLite library (FTS5), PDF download + text extraction, collections, tags, favorites.

---

## Iteration Plan

### Phase 3: MCP Server ← next

**Spec:** [`spec-mcp.md`](spec-mcp.md)

Expose PaperShelf's capabilities as an MCP server so Claude (and other MCP clients) can search arXiv, query the local library, and manage papers programmatically.

**Why first:** High leverage — turns PaperShelf into a research tool that Claude can use directly. Small surface area (reuses existing arXiv client + database). No UI work needed.

**Deliverables:**
- MCP server running inside Electron main process (Streamable HTTP on 127.0.0.1)
- Tools: search_arxiv, search_library, get_paper, list_papers, save_paper, fetch_paper_html, get_bibtex, list_collections, list_tags
- MCP client config via `"url"` field

---

### Phase 4: Citations & Discovery

**Spec:** [`spec-citations.md`](spec-citations.md)

Citation data via Semantic Scholar, category feeds, author following, and smart recommendations.

**Depends on:** Phase 3 (MCP tools for citations)

**Deliverables:**
- Semantic Scholar citation integration (counts, citing papers, references)
- Category subscriptions with new paper feeds
- Author following with notifications
- "Discover" sidebar section showing recommended papers
- MCP tools for citations and discovery

---

### Phase 5: PDF Viewer

**Spec:** [`spec.md`](spec.md) Phase 3

Render PDFs inline with pdf.js. Page navigation, zoom, text layer for selection.

**Depends on:** Nothing (can be done in parallel with Phase 4)

**Deliverables:**
- pdf.js integration in right panel
- Toolbar: page nav, zoom, fit-to-width
- Text layer enabled (prerequisite for annotations)

---

### Phase 6: Annotations

**Spec:** [`spec.md`](spec.md) Phase 4

Highlight text in PDFs, add comments, color-code highlights. Annotation side panel.

**Depends on:** Phase 5 (PDF viewer)

**Deliverables:**
- Highlight mode with text selection → PDF coordinate rects
- Persist highlights to SQLite
- Comment popovers, color picker
- Annotation side panel with navigation

---

### Phase 7: RAG Chat

**Spec:** [`spec.md`](spec.md) Phase 5

Chat with your papers using retrieval-augmented generation. Scope to single paper, collection, or entire library.

**Depends on:** Enhanced by Phase 6 (highlight chunks get boosted), but can start without it

**Deliverables:**
- Chunking pipeline (on save)
- FTS5-based retrieval (v1), vector embeddings (v2)
- Vercel AI SDK streaming (multi-provider)
- Chat UI with citations linking back to source pages
- Highlight-boosted retrieval

---

### Phase 8: Polish

Settings, keyboard shortcuts, error handling, loading/empty states.

**Deliverables:**
- Settings modal (LLM provider, API keys, theme)
- All keyboard shortcuts
- Error handling, loading states, empty states

---

### Phase 9: Mac App Packaging

Ship PaperShelf as a proper macOS application using electron-builder.

**Depends on:** Phase 8 (app should be polished before distributing)

**Deliverables:**
- electron-builder config (`electron-builder.yml`)
- `.app` bundle (universal binary: Intel + Apple Silicon)
- DMG installer with background image + Applications symlink
- Code signing with Developer ID certificate
- Apple notarization for Gatekeeper
- Auto-updater via `electron-updater` (GitHub Releases or S3)
- App icon (`.icns`)
- Proper `Info.plist` metadata (bundle ID, version, copyright)
- File associations for `.pdf` (optional)

---

## Dependency Graph

```
Phase 3 (MCP Server) ─────┐
        │                  │
        ▼                  │
Phase 4 (Citations)        │
                           │
Phase 5 (PDF Viewer) ──────┤
        │                  │
        ▼                  │
Phase 6 (Annotations)      ├── Phase 8 (Polish) → Phase 9 (Mac App)
        │                  │
        ▼                  │
Phase 7 (RAG Chat) ────────┘
```

Phases 3+4 and 5+6 can be done in parallel tracks.
