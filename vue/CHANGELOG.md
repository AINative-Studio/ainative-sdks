# @ainative/vue-sdk Changelog

## [1.0.0] - 2026-01-15

### Initial Release

Official Vue SDK for AINative Studio API with composables for chat completions and credit management.

#### Features
- `useAINative()` composable for accessing SDK configuration
- `useChat()` composable for streaming chat completions
- `useCredits()` composable for real-time credit balance management
- Vue 3 Composition API support
- Full TypeScript support with type definitions
- ESM and CommonJS module support
- Vue 3+ compatibility

#### Module Exports
- Main export (`@ainative/vue-sdk`): All composables and types

#### Technical Details
- Built with Rollup for optimal bundle size
- Dual ESM/CJS output for compatibility
- TypeScript definitions included
- Comprehensive test coverage
- Peer dependency: vue ^3.0.0

#### Documentation
- README with quick start guide
- API reference for all composables
- Example implementations

#### Testing
- Unit tests with Vitest
- Vue Test Utils integration
- Happy-DOM for DOM testing
