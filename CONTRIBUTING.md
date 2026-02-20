# Contributing to PaperShelf

Thank you for your interest in contributing to PaperShelf! This document provides guidelines for development and testing.

## Development Setup

```bash
npm install          # also runs @electron/rebuild for better-sqlite3

# dev mode with isolated data directory
PAPERSHELF_DATA_DIR=/tmp/papershelf-dev npm run dev
```

## Building

```bash
npm run build        # build main + renderer
npm run pack         # create distributable package
npm run dist         # build and package for distribution
```

## Testing

```bash
npm run test         # run tests (vitest)
npm run lint         # biome check
npm run lint:fix     # biome auto-fix
npm run test:e2e     # end-to-end tests (playwright)
```

## macOS Development Notes

### Installing from DMG during development

When testing installation from DMG files, **always use `ditto` instead of `cp`** to copy the .app bundle:

```bash
# Correct method
ditto "/Volumes/App Name/App.app" "/Applications/App.app"

# Incorrect method (breaks code signatures)
cp -r "/Volumes/App Name/App.app" "/Applications/App.app"
```

**Why this matters:**
- `ditto` preserves extended attributes (including code signature metadata)
- `cp -r` strips extended attributes, breaking code signatures
- Broken signatures trigger Gatekeeper warnings: "App is damaged and can't be opened"

### Verifying code signatures

```bash
codesign -vvv --deep --strict /Applications/App.app
```

Should show: "valid on disk" and "satisfies its Designated Requirement"

## Code Style

- **Formatter/Linter:** Biome
- **TypeScript:** Strict mode enabled
- **Commit messages:** Follow conventional commits style

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## Architecture Overview

- **Main process:** CommonJS via `tsc` (`module: "node16"`)
- **Renderer:** ESM bundled by Vite
- **Database:** SQLite with Better SQLite3
- **IPC:** Preload bridge pattern with TypeScript types

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Releases

Releases are handled automatically by the GitHub Actions Release workflow. Do not bump versions manually in package.json.

## Support

Questions? Open an issue or discussion on GitHub.
