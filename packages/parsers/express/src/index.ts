// parsers/express — Phase 0 stub
// Phase 1 implementation: Express.js static parser v1.0.0
//   - capability declaration (routes: supported, models: supported, middleware: supported,
//     auth: not supported, rateLimits: not supported)
//   - golden-repo test suite (no parser change merges without this suite passing)
// CI-enforced: may NOT import a DB client, LLM client, or make outbound HTTP requests.

import type { ParserCapabilities } from '@api-catalog/contracts';
import type { IParser } from '@api-catalog/parser-registry';

// Capability declaration for express parser v1.0.0
// Generated from this file — never hand-maintained in a separate central table.
export const EXPRESS_PARSER_CAPABILITIES: ParserCapabilities = {
  routes: 'supported',
  models: 'supported',
  middleware: 'supported',
  auth: 'not supported',
  rateLimits: 'not supported',
} as const;

// Placeholder — full IParser implementation in Phase 1
export type { IParser };
