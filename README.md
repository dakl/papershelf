# PaperShelf

A native-feeling Mac desktop app for managing research papers. Search arXiv, save and annotate PDFs, organize with collections and tags, explore citation graphs, and let AI assistants access your library via MCP.

## Install

Download the latest `.dmg` from [Releases](https://github.com/dakl/papershelf/releases), open it, and drag PaperShelf to Applications.

> Requires macOS (Apple Silicon). The app is signed and notarized.

## Features

- **arXiv search** -- find papers and save them to your library with one click
- **PDF viewer** -- read, highlight, and add sticky notes directly on papers
- **Collections & tags** -- organize papers with colored collections and tags
- **Citation graph** -- visualize how papers cite each other using Semantic Scholar data
- **Full-text search** -- FTS5-powered search across titles, abstracts, and full paper text
- **MCP server** -- expose your library to AI assistants (Claude, etc.) over the Model Context Protocol
- **Keyboard-driven** -- customizable shortcuts for fast navigation

## MCP integration

PaperShelf includes a built-in MCP server that lets AI assistants search your library, read papers, and manage collections.

### Setup

1. Open PaperShelf Settings and enable the MCP server
2. Add to your MCP client config (e.g. Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "papershelf": {
      "url": "http://127.0.0.1:3847/mcp"
    }
  }
}
```

Port 3847 in production, 13847 in development.

### Available tools

| Tool | Description |
|------|-------------|
| `search_arxiv` | Search arXiv for papers |
| `search_library` | Full-text search your saved papers |
| `get_paper` | Get details for a specific paper |
| `list_papers` | List papers with optional collection/tag filters |
| `save_paper` | Save an arXiv paper to your library |
| `fetch_paper_html` | Fetch the HTML content of a paper |
| `get_bibtex` | Generate a BibTeX citation for a paper |
| `list_collections` | List all collections |
| `list_tags` | List all tags |
| `list_categories` | List arXiv categories |
| `create_collection` | Create a new collection |
| `create_tag` | Create a new tag |
| `add_paper_to_collection` | Add a paper to a collection |
| `remove_paper_from_collection` | Remove a paper from a collection |
| `add_tag_to_paper` | Add a tag to a paper |
| `remove_tag_from_paper` | Remove a tag from a paper |
| `toggle_favorite` | Toggle favorite status on a paper |

## Development

```bash
npm install          # also runs @electron/rebuild for better-sqlite3

# dev mode with isolated data directory
PAPERSHELF_DATA_DIR=/tmp/papershelf-dev npm run dev

npm run test         # run tests (vitest)
npm run lint         # biome check
npm run build        # build main + renderer
```

## Tech stack

Electron + React + TypeScript + SQLite + Tailwind CSS

## License

[MIT](LICENSE)

## Support

If you find PaperShelf useful, consider [sponsoring the project](https://github.com/sponsors/dakl).
