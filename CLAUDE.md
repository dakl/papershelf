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
- **Database**: Split into `src/main/db/` modules (connection, papers, collections, tags) with `database.ts` re-exporting everything for backward compatibility
- **MCP tools**: Split into `src/main/mcp/tools/` modules (search-tools, paper-tools, organization-tools, resolvers) with `mcp/tools.ts` re-exporting
- **Services**: Shared business logic in `src/main/services/` (save-paper, pdf-reader, pdf-annotator)
- **Constants**: `src/main/constants.ts` (backend), `src/renderer/constants.ts` (frontend)

### IPC Channels

Pattern: `<domain>:<action>` — e.g., `papers:save`, `collections:list`, `tags:addToPaper`, `mcp:getStatus`

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
- **Test file location**: `src/main/__tests__/`, `src/renderer/__tests__/`
- **Run**: `npm run test` (rebuilds native modules before/after)

### Test Requirements

Follow **test-driven development (TDD)**: write a failing test first, then implement the feature to make it pass. Tests are mandatory for all code changes. Always run `npm run test` after making changes.

- **Data flow defaults**: When a DB query can return `undefined`/`null` for a field that the UI consumes, test that the hydration layer provides a sensible default. The UI should never receive `undefined` for a field it conditionally renders on.
- **Event-driven UI state**: When backend events drive UI state changes (e.g., `INDEXING_PROGRESS` → badge states), test the full state machine: every event type must be covered, including transitions between states and the final/reset state.
- **Conditional rendering**: When UI elements render conditionally (e.g., `{value && <Component />}`), ensure tests verify that the condition is met for all expected cases — not just the happy path. A missing default value that makes a field `undefined` will silently hide UI elements.
- **Renderer logic tests**: Extract non-trivial derivation logic (state machines, computed props) into pure functions and test them in `src/renderer/__tests__/`. This avoids needing a DOM environment while still catching logic bugs.

### Adding a New DB Domain

1. Create `src/main/db/<domain>.ts` with query/mutation functions
2. Re-export from `src/main/db/index.ts`
3. Re-export from `src/main/database.ts` (keeps backward-compat imports working)

### Adding a New IPC Channel

All three files must be updated together:

1. **Handler** — `src/main/ipc-handlers.ts`: add `ipcMain.handle('<domain>:<action>', ...)`
2. **Preload bridge** — `src/main/preload.ts`: add method to the `api` object
3. **Type** — `src/shared/types.ts`: add method signature to `ElectronAPI` interface

### Adding a New MCP Tool

1. Add the tool handler to the appropriate `register*Tools()` function in `src/main/mcp/tools/`
2. Add an entry to `TOOL_METADATA` in `src/main/mcp/tools/index.ts` (drives the Settings UI)
3. Tool calls are automatically instrumented (logged to `tool_call_log`) via the Proxy in `registerTools()`

### Exposing Backend Data to the UI

The full path for surfacing new backend data in the renderer:

1. DB function (`src/main/db/`) → re-export chain → IPC handler → preload bridge → `ElectronAPI` type
2. Zustand store action calls `window.electronAPI.newMethod()` and sets state
3. Component reads from store and calls the load action on mount

### Key Constants

- `DEFAULT_COLOR`: `#007AFF` (macOS system blue)
- `COLOR_PALETTE`: 8 macOS system colors (renderer only)

### Development Platforms

- **macOS**: Install deps with `npm install` and run directly — no extra tooling needed
- **Linux**: Use the Nix flake (`flake.nix`) which provides all Electron runtime deps (GTK, X11, Mesa, etc.) and native module build tools. Use `nix develop` for a dev shell or `nix run` to start dev mode directly
- Releases are macOS-only (Apple Silicon) — no Linux distributable is built yet

### Commands

- `npm run build` — build main + renderer
- `npm run test` — rebuild native modules, run vitest, rebuild for electron
- `npm run lint` — biome check
- `npm run lint:fix` — biome auto-fix
- `PAPERSHELF_DATA_DIR=/tmp/papershelf-dev npm run dev` — dev mode with isolated data
