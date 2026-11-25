# AGENTS.md — AINative SDKs

Official AINative Studio client SDKs: React, Vue, Svelte, and Next.js. Each
package wraps the AINative Studio API (chat completions, agents, memory,
credits, tasks) in framework-native hooks/composables/stores.

## What this repo is

A public monorepo of independently-versioned, independently-published npm
packages — not a service, not an MCP server, not an agent plugin. There is
no agent-callable tool surface here; `plugin.json` (agent-plugins.org) does
not apply to this repo for that reason. If you're looking for AINative's
MCP servers, see `https://docs.ainative.studio/.well-known/mcp.json`.

## Packages (real npm names — verify before assuming)

| Directory | npm package | Latest (verify live, don't trust this file) |
|---|---|---|
| `react/` | `@ainative/react-sdk` | see `npm view @ainative/react-sdk version` |
| `vue/` | `@ainative/vue-sdk` | see `npm view @ainative/vue-sdk version` |
| `svelte/` | `@ainative/svelte-sdk` | see `npm view @ainative/svelte-sdk version` |
| `nextjs/` | `@ainative/next-sdk` | see `npm view @ainative/next-sdk version` |

Each package's own README (linked from the root [README.md](README.md)) has
install/usage instructions and the Browser CORS Requirement section every
client-side package needs.

## Where the real API lives

These packages are thin clients. For live, authoritative API discovery, go
to the backend directly, not this repo:

- **API base**: `https://api.ainative.studio`
- **OpenAPI spec** (served by the real API, always current):
  `https://api.ainative.studio/api/v1/openapi.json`
- **OAuth 2.0 discovery** (RFC 8414):
  `https://api.ainative.studio/.well-known/oauth-authorization-server`
- **Documentation**: `https://docs.ainative.studio`

## Working in this repo (for a coding agent)

- No shared root `package.json` or build step — `cd` into the package
  directory you're changing (`react/`, `vue/`, `svelte/`, or `nextjs/`)
  before running `npm install`, `npm test`, `npm run lint`, `npm run build`.
- Tests and lint must pass per-package before any change; see
  [CLAUDE.md](CLAUDE.md) for the full contributor rules.
- No AI attribution in commits.

## License / reuse

MIT © AINative Studio. See [LICENSE](LICENSE) in each package directory.
