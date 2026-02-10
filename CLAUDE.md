# PaperShelf

## Releases

- **Never bump the version in package.json manually.** The version is set exclusively by the GitHub Actions Release workflow (`release.yml`) via `npm version --no-git-tag-version`.
- To release: trigger the Release workflow with the desired version string. It handles version bumping, building, and creating the GitHub release.

## Development Conventions

### Architecture

- **Main process** (`src/main/`): CommonJS via `tsc -p tsconfig.main.json` (`module: "node16"`)
- **Renderer** (`src/renderer/`): ESM bundled by Vite
- **Shared types**: `src/shared/types.ts` — imported by both main and renderer
- **IPC flow**: renderer → `preload.ts` contextBridge → `ipc-handlers.ts` → domain modules
- **Database**: Split into `src/main/db/` modules (connection, papers, collections, tags, citations) with `database.ts` re-exporting everything for backward compatibility
- **MCP tools**: Split into `src/main/mcp/tools/` modules (search-tools, paper-tools, organization-tools, resolvers) with `mcp/tools.ts` re-exporting
- **Services**: Shared business logic in `src/main/services/` (save-paper, citation-cache)
- **Constants**: `src/main/constants.ts` (backend), `src/renderer/constants.ts` (frontend)

### IPC Channels

Pattern: `<domain>:<action>` — e.g., `papers:save`, `collections:list`, `tags:addToPaper`, `citations:fetch`, `mcp:getStatus`

### Error Handling

- IPC handlers for mutations return `{ success: boolean; error?: string }` or `{ success: boolean; paper?: LibraryPaper }`
- IPC handlers for queries return data directly (throw on failure)
- MCP tools return `{ content: [{ type: 'text', text }] }` always — errors are formatted as text

### MCP Tool Pattern

```typescript
if (isEnabled('tool_name'))
  server.tool('tool_name', 'description', { ...zodSchema }, async (params) => {
    return { content: [{ type: 'text' as const, text: result }] };
  });
```

Tools are registered per group via `registerSearchTools`, `registerPaperTools`, `registerOrganizationTools`.

### Store Pattern (Zustand)

```typescript
export const useStore = create<StoreState>((set, get) => ({
  ...initialState,
  action: async () => {
    const result = await window.electronAPI.someCall();
    set({ field: result });
  },
}));
```

### Test Pattern

- **Framework**: Vitest with `globals: true`
- **Database tests**: Create temp SQLite file in `os.tmpdir()`, clean up in `afterEach`
- **Mock paths**: `vi.mock('../paths', () => ({ getDataDir: () => '' }))`
- **Test file location**: `src/main/__tests__/`
- **Run**: `npm run test` (rebuilds native modules before/after)

### Key Constants

- `DEFAULT_COLOR`: `#007AFF` (macOS system blue)
- `CITATION_CACHE_TTL_DAYS`: `30`
- `SEMANTIC_SCHOLAR_RATE_LIMIT_MS`: `350` (~3 req/sec)
- `COLOR_PALETTE`: 8 macOS system colors (renderer only)

### Commands

- `npm run build` — build main + renderer
- `npm run test` — rebuild native modules, run vitest, rebuild for electron
- `npm run lint` — biome check
- `npm run lint:fix` — biome auto-fix
- `PAPERSHELF_DATA_DIR=/tmp/papershelf-dev npm run dev` — dev mode with isolated data
