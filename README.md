# PaperShelf

A native-feeling Mac desktop app for searching arXiv, organizing research papers, annotating PDFs, and chatting with your paper library using RAG.

Built with Electron + React + TypeScript + Tailwind CSS + SQLite.

## Features

- **arXiv search** — search and save papers directly from arXiv
- **Paper library** — organize with collections, tags, and favorites
- **Full-text search** — FTS5-powered search across titles, abstracts, and extracted PDF text
- **PDF management** — automatic download and text extraction on save
- **MCP server** (planned) — expose search and library as tools for Claude and other MCP clients

## Setup

```bash
npm install
npm run dev
```

`npm install` runs `@electron/rebuild` automatically to compile `better-sqlite3` against Electron's Node version.

## Development

```bash
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
│   └── preload.ts
├── renderer/        # React frontend (ESM, Vite)
│   ├── components/
│   ├── stores/      # Zustand state
│   └── hooks/
└── shared/
    └── types.ts
```

## Roadmap

See [spec-roadmap.md](spec-roadmap.md) for the full iteration plan.

| Phase | Status |
|-------|--------|
| 1. Shell & Search | Done |
| 2. Library & Persistence | Done |
| 3. MCP Server | Next |
| 4. Citations & Discovery | Planned |
| 5. PDF Viewer | Planned |
| 6. Annotations | Planned |
| 7. RAG Chat | Planned |
| 8. Polish | Planned |
| 9. Mac App Packaging | Planned |
