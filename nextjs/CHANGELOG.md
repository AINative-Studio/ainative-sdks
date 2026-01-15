# @ainative/next-sdk Changelog

## [1.0.1] - 2026-01-14

### Fixed
- Updated repository URL to public GitHub repo (https://github.com/AINative-Studio/ainative-sdks)
- Fixed broken repository and issues links that pointed to private repo
- Updated dependency to use published @ainative/react-sdk@^1.0.0

## [1.0.0] - 2026-01-14

### Initial Release

Official Next.js SDK for AINative Studio API with server and client utilities for both App Router and Pages Router.

#### Features
- Server-side utilities for App Router and Pages Router
- Client-side React hooks integration via `@ainative/react-sdk`
- Edge Runtime compatible
- Route handler utilities for API routes
- Server Component support
- Full TypeScript support with type definitions
- ESM and CommonJS module support
- Next.js 13+ and 14+ compatibility

#### Module Exports
- Main export (`@ainative/next-sdk`): Full SDK access
- Server export (`@ainative/next-sdk/server`): Server-only utilities
- Client export (`@ainative/next-sdk/client`): Client-side hooks

#### Technical Details
- Built with Rollup for optimal bundle size
- Dual ESM/CJS output for compatibility
- TypeScript definitions for all exports
- Comprehensive test coverage (39 tests)
- Peer dependencies: next ^13.0.0 || ^14.0.0, react ^18.0.0
- Dependency: @ainative/react-sdk ^1.0.0

#### Documentation
- README with quick start guide
- App Router and Pages Router examples
- Server Component and Route Handler examples
- API reference for all utilities

#### Testing
- 39 unit tests with 100% pass rate
- Server and client component testing
- Mock implementations for Next.js APIs
- Edge Runtime compatibility tests
