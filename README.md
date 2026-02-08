# PaperShelf

A native-feeling Mac desktop app for searching arXiv, organizing research papers, annotating PDFs, and chatting with your paper library using RAG.

Built with Electron + React + TypeScript + Tailwind CSS + SQLite.

## Install

Download the latest `.dmg` from [Releases](https://github.com/dakl/papershelf/releases) and drag PaperShelf to `/Applications`.

On first launch, right-click the app and select **Open** to bypass the "unidentified developer" dialog.

## Features

- **arXiv search** — search and save papers directly from arXiv
- **Paper library** — organize with collections, tags, and favorites
- **Full-text search** — FTS5-powered search across titles, abstracts, and extracted PDF text
- **PDF management** — automatic download and text extraction on save
- **MCP server** — expose search and library as tools for Claude and other MCP clients

## MCP Server

PaperShelf includes an MCP server that lets Claude search your paper library, fetch arXiv papers, and more.

### Claude Desktop

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "papershelf": {
      "command": "/Applications/PaperShelf.app/Contents/MacOS/PaperShelf",
      "args": ["--mcp-mode"]
    }
  }
}
```

Restart Claude Desktop to pick up the change.

### Available Tools

| Tool | Description |
|------|-------------|
| `search_arxiv` | Search arXiv for papers |
| `search_library` | Full-text search your saved papers |
| `get_paper` | Get details for a specific paper |
| `list_papers` | List papers in your library |
| `save_paper` | Save an arXiv paper to your library |
| `fetch_paper_html` | Fetch the HTML content of a paper |
| `get_bibtex` | Get BibTeX citation for a paper |
| `list_collections` | List your paper collections |
| `list_tags` | List tags |
| `list_categories` | List arXiv categories |

## Development

```bash
npm install          # Also runs @electron/rebuild for better-sqlite3
npm run dev          # Start Electron + Vite + TypeScript watch
npm run build        # Build main + renderer
npm run test         # Run tests (vitest)
```

## Architecture

```
src/
├── main/            # Electron main process (CommonJS)
│   ├── index.ts     # App entry, window creation
│   ├── arxiv-client.ts
│   ├── database.ts  # SQLite + FTS5
│   ├── pdf-processor.ts
│   ├── ipc-handlers.ts
│   ├── mcp/         # MCP server (stdio + HTTP)
│   └── preload.ts
├── renderer/        # React frontend (ESM, Vite)
│   ├── components/
│   ├── stores/      # Zustand state
│   └── hooks/
└── shared/
    └── types.ts
```
