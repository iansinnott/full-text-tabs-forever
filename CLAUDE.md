# CLAUDE.md - Full Text Tabs Forever

This is a Chrome extension, not a normal web app.

## Build/Test/Lint Commands

- Build: `bun run build`
- Watch/Dev: `bun run dev`
- Test: `bun run test`
- Run single test: `bun test src/path/to/file.test.ts`
- Type check: `bun run type-check` (runs `tsc --noEmit`)
- Chrome build: `bun run build:chrome`
- Firefox build: `bun run build:firefox`

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
