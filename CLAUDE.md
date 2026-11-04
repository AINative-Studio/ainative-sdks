# AINative SDKs

Monorepo of official AINative Studio client SDKs: React, Vue, Svelte, and
Next.js. Each package wraps the AINative Studio API (chat, agents, memory,
credits, tasks) in framework-native hooks/composables/stores.

## Project Structure

- `react/` — `@ainative/react-sdk` (hooks, Jest)
- `vue/` — `@ainative/vue-sdk` (composables, Vitest)
- `svelte/` — `@ainative/svelte-sdk` (stores, Vitest)
- `nextjs/` — `@ainative/nextjs-sdk` (Server Components + API Routes
  helpers, re-exports the React SDK for Client Components; Jest)
- `docs/` — shared documentation

Each package is independently versioned and published to npm; there is no
shared root `package.json` or build step.

## Critical Rules

- **No AI attribution** in commits.
- **Tests before commits.** Each package has its own test runner
  (`npm test` inside that package's directory) — there's no repo-wide
  test command.
- **Each package must lint clean.** `npm run lint` inside the package
  directory; all four packages have an `.eslintrc.js`.
- Browser CORS setup (`react`, `vue`, `svelte`, `nextjs`'s Client
  Component path) is a common support question — see each package's
  README "Browser CORS Requirement" section before assuming a bug.

## Common Tasks

```bash
# Work on one package (run from inside react/, vue/, svelte/, or nextjs/)
npm install
npm test
npm run lint
npm run build
```

## Support

See [SUPPORT.md](SUPPORT.md).
