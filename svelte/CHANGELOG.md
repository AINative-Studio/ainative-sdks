# @ainative/svelte-sdk Changelog

## [1.0.0] - 2026-01-15

### Initial Release

Official Svelte SDK for AINative Studio API with reactive stores for chat completions and credit management.

#### Features
- `setAINativeConfig()` for SDK configuration
- `createChat()` store factory for streaming chat completions
- `createCredits()` store factory for real-time credit balance management
- Svelte reactive stores pattern
- Full TypeScript support with type definitions
- ESM and CommonJS module support
- Svelte 4+ and 5+ compatibility

#### Module Exports
- Main export (`@ainative/svelte-sdk`): All stores and types
- Source exports for Svelte compiler optimization

#### Technical Details
- Built with Rollup for optimal bundle size
- Dual ESM/CJS output for compatibility
- TypeScript definitions included
- Comprehensive test coverage
- Peer dependencies: svelte ^4.0.0 || ^5.0.0

#### Documentation
- README with quick start guide
- API reference for all stores
- Example implementations

#### Testing
- Unit tests with Vitest
- Svelte Testing Library integration
- JSDOM for DOM testing
