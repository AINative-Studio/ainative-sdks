# @ainative/react-sdk Changelog

## [1.1.0] - 2026-11-08

### Changed
- Widened `react` peer dependency to `^18.0.0 || ^19.0.0`. A fresh Vite scaffold defaults to React 19, which previously failed `npm install` with an ERESOLVE peer-dependency conflict against this package's React 18-only constraint.
- Updated test tooling to `@testing-library/react@^16` (required for React 19) and added `@testing-library/dom` as an explicit devDependency.

### Verified
- Full test suite (103 tests, 8 suites) passes against both React 18.2.0 and genuinely-confirmed React 19.3.1 + `@testing-library/react@16.3.3`.
- `npm run build` (Rollup) compiles cleanly.
- A real `npm install` of this package into a fresh `npm create vite@latest -- --template react-ts` scaffold (React 19.3.1 default) succeeds with no `--legacy-peer-deps` flag, and a consumer app using `AINativeProvider`/`useChat` builds cleanly with `tsc -b && vite build`.

## [1.0.1] - 2026-01-14

### Fixed
- Updated repository URL to public GitHub repo (https://github.com/AINative-Studio/ainative-sdks)
- Fixed broken repository and issues links that pointed to private repo

## [1.0.0] - 2026-01-14

### Initial Release

Official React SDK for AINative Studio API with simple hooks for chat completions and credit management.

#### Features
- `useAINative()` hook for accessing SDK client
- `useChat()` hook for streaming chat completions
- `useCredits()` hook for real-time credit balance management
- `AINativeProvider` context provider with API key configuration
- Full TypeScript support with type definitions
- ESM and CommonJS module support
- React 18+ compatibility

#### Technical Details
- Built with Rollup for optimal bundle size
- Dual ESM/CJS output for compatibility
- TypeScript definitions included
- Comprehensive test coverage (17 tests)
- Peer dependency: react ^18.0.0

#### Documentation
- README with quick start guide
- API reference for all hooks
- Example implementations

#### Testing
- 17 unit tests with 100% pass rate
- React Testing Library integration
- Mock service workers for API testing
