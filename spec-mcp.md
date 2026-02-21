# PaperShelf — MCP Server Specification

## Overview

PaperShelf exposes an MCP (Model Context Protocol) server so Claude and other MCP clients can search arXiv, query the local paper library, save papers, and retrieve full paper content — all programmatically.

Inspired by [arxbar](../arxbar), which pioneered this pattern as a menu bar + MCP server for arXiv.

## Architecture

### Architecture

```
┌───────────────────────────────────────────────┐
│  Electron Main Process                        │
│                                               │
│  ┌─────────────┐  ┌────────────────────────┐  │
│  │  App Window  │  │  MCP HTTP Server       │  │
│  │  (React UI)  │  │  (127.0.0.1:3847)     │  │
│  └──────┬───────┘  └──────────┬─────────────┘  │
│         │                     │                │
│         ├─────────────────────┤                │
│         │   Shared Services   │                │
│         │  ┌───────────────┐  │                │
│         │  │ arXiv client  │  │                │
│         │  │ SQLite DB     │  │                │
│         │  │ PDF processor │  │                │
│         │  └───────────────┘  │                │
│         └─────────────────────┘                │
└───────────────────────────────────────────────┘
```

The Electron app runs both the UI and an MCP HTTP server on `127.0.0.1:3847`. Both share the same database and services. MCP clients connect via the `"url"` config field — no stdio bridge needed.

### Technology

- `@modelcontextprotocol/sdk` — MCP protocol implementation
- `StreamableHTTPServerTransport` — HTTP server on 127.0.0.1:3847
- `zod` — tool parameter validation

## Project Structure

```
src/main/
├── mcp/
│   ├── server.ts          # MCP server creation + registration
│   ├── tools.ts           # Tool definitions (search, fetch, save, etc.)
│   └── http-server.ts     # HTTP transport (StreamableHTTPServerTransport)
├── arxiv/
│   ├── client.ts          # Existing arXiv API client (refactored from arxiv-client.ts)
│   ├── parser.ts          # XML parsing (extracted from client)
│   ├── html.ts            # HTML→markdown fetcher (new, from arxbar)
│   ├── categories.ts      # arXiv category definitions (new, from arxbar)
│   ├── rate-limiter.ts    # 3-second rate limiting (new)
│   └── types.ts           # ArXiv-specific types (moved from shared)
├── database.ts            # Existing SQLite (unchanged)
├── pdf-processor.ts       # Existing PDF download + extraction
├── ipc-handlers.ts        # Existing IPC (unchanged)
├── preload.ts             # Existing preload (unchanged)
└── index.ts               # Updated: dual-mode entry point
```

The key refactor is extracting the existing `arxiv-client.ts` into a proper `arxiv/` module with separated concerns, and adding the `mcp/` module.

## Entry Point

The Electron app starts normally and launches the MCP HTTP server from `app.whenReady()` if enabled in Settings.

## MCP Tools

### `search_arxiv`

Search arXiv papers by query. Reuses existing arXiv client.

**Input:**
```typescript
{
  query: string;                    // arXiv query (supports arXiv search syntax)
  max_results?: number;             // 1–100, default 10
  sort_by?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  categories?: string[];            // Filter: ['cs.AI', 'cs.LG', ...]
}
```

**Output:** Array of paper objects with id, title, authors, summary, dates, urls, categories.

### `search_library`

Full-text search across saved papers using FTS5.

**Input:**
```typescript
{
  query: string;                    // FTS5 query
}
```

**Output:** Array of library papers matching the query.

### `get_paper`

Get full details for a paper by arXiv ID or library ID.

**Input:**
```typescript
{
  id: string;                       // arXiv ID (e.g., "2301.12345") or library UUID
}
```

**Output:** Full paper metadata including collections, tags, and availability info.

### `list_papers`

List papers in the library with optional filtering.

**Input:**
```typescript
{
  filter?: 'all' | 'favorites' | 'recent';
  collection_id?: string;
  tag_id?: string;
  limit?: number;                   // Default 50
}
```

**Output:** Array of library papers.

### `save_paper`

Save an arXiv paper to the local library. Downloads PDF and extracts text.

**Input:**
```typescript
{
  arxiv_id: string;                 // e.g., "2301.12345"
}
```

**Output:**
```typescript
{
  success: boolean;
  paper_id?: string;                // Library UUID
  already_exists?: boolean;
  error?: string;
}
```

### `fetch_paper_html`

Fetch the full paper as markdown from arXiv's HTML rendering. Much richer than the extracted PDF text — preserves structure, math, figures, and references.

**Input:**
```typescript
{
  arxiv_id: string;
}
```

**Output:**
```typescript
{
  arxiv_id: string;
  title: string;
  markdown: string;                 // Full paper content as markdown
  url: string;                      // arxiv.org/html/{id}
  available: boolean;               // false if no HTML rendering exists
}
```

**Implementation:** Fetch `https://arxiv.org/html/{arxiv_id}`, convert HTML→markdown using Turndown. Preserve math elements. Same approach as arxbar.

### `get_bibtex`

Generate a BibTeX citation entry for a paper.

**Input:**
```typescript
{
  arxiv_id: string;
}
```

**Output:**
```typescript
{
  bibtex: string;                   // Formatted BibTeX entry
}
```

### `list_collections`

List all collections with paper counts.

**Input:** None.

**Output:** Array of `{ id, name, color, paper_count }`.

### `list_tags`

List all tags with paper counts.

**Input:** None.

**Output:** Array of `{ id, name, color, paper_count }`.

### `list_categories`

List all arXiv categories.

**Input:** None.

**Output:** Array of `{ id, name, group }` (e.g., `{ id: "cs.AI", name: "Artificial Intelligence", group: "Computer Science" }`).

## Rate Limiting

arXiv requests are rate-limited to 1 request per 3 seconds (arXiv's policy). A shared `RateLimiter` instance is used by both MCP tools and the existing IPC handlers.

```typescript
// src/main/arxiv/rate-limiter.ts
let lastRequestTime = 0;
const MIN_DELAY_MS = 3000;

export async function waitForRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(r => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}
```

## MCP Client Configuration

Add to your MCP client config (e.g. Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "papershelf": {
      "url": "http://127.0.0.1:3847/mcp"
    }
  }
}
```

Port 3847 in production, 13847 in development. PaperShelf must be running with the MCP server enabled in Settings.

## Response Format

All tools return JSON wrapped in MCP text content:

```typescript
function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }]
  };
}
```

## Dependencies (new)

```json
{
  "@modelcontextprotocol/sdk": "^1.12.0",
  "turndown": "^7.2.0",
  "zod": "^3.24.0"
}
```

`axios` is not needed — the existing codebase uses `fetch` and `fast-xml-parser`.

## Implementation Order

1. **Install deps** — `@modelcontextprotocol/sdk`, `zod`, `turndown`
2. **Refactor arxiv client** — Extract `arxiv-client.ts` into `arxiv/` module with rate limiter
3. **Create `mcp/server.ts`** — Server setup, tool registration
4. **Create `mcp/tools.ts`** — Implement all tools using existing services
5. **Create `mcp/http-server.ts`** — HTTP transport on port 3847
6. **Create `arxiv/html.ts`** — HTML→markdown fetcher (port from arxbar)
7. **Create `arxiv/categories.ts`** — Category definitions (port from arxbar)
8. **Update `index.ts`** — Dual-mode entry point
9. **Test with MCP inspector** — `npx @modelcontextprotocol/inspector`
10. **Test with Claude Desktop** — Configure and verify all tools
