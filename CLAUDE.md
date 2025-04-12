# CLAUDE.md - Full Text Tabs Forever

This is a Chrome extension, not a normal web app.

## Build/Test/Lint Commands

- Build: `bun run build` (combines content script and main build)
- Watch/Dev: `bun run dev` (concurrently watches both content script and main)
- Dev Chrome: `bun run dev:chrome` (Chrome-specific dev mode)
- Test: `bun run test`
- Run single test: `bun test src/path/to/file.test.ts`
- Type check: `bun run type-check` (runs `tsc --noEmit`)
- Svelte check: `bun run check` (runs svelte-check)
- Chrome build: `bun run build:chrome`
- Firefox build: `bun run build:firefox`
- Clean build: `bun run build:clean` (removes dist directory contents)

## Code Style Guidelines

- TypeScript with strict mode enabled
- Use ES modules (import/export)
- Follow functional programming patterns where possible
- Tests use Bun's built-in test runner with describe/it/expect pattern
- 2-space indentation
- No semicolons at line ends
- Use arrow functions for callbacks
- Prefer const over let, avoid var
- Use utility functions from src/common/utils.ts
- Handle errors with try/catch blocks and proper logging
- Use async/await for asynchronous code
- Prefer explicit typing over 'any'
- Use camelCase for variables/functions, PascalCase for classes/interfaces
- Tailwind CSS for styling
- Svelte components with TypeScript
- Zod for validation

## Naming Conventions

- Component files: PascalCase.svelte
- Utility files: kebab-case.ts
- Test files: name.test.ts adjacent to implementation
- Use descriptive, meaningful names

## Project Organization

- Background service worker in src/background/
- UI components in src/ui/
- Common utilities in src/common/
- Content scripts in src/content-scripts/
- Assets in src/assets/
- Types in src/types.ts
- Embedding pipeline in src/background/embedding/
- PGLite database functionality in src/background/pglite/
- UI stores in src/ui/store/
- UI pages in src/ui/pages/

## Technologies

- Vite for building
- Svelte for UI components
- SPA routing with svelte-spa-router
- Database backends (PGLite and VLCN options)
- Embedded SQLite with @electric-sql/pglite
- Embedding functionality with @xenova/transformers
- Supports sortable views by last visited date or rank