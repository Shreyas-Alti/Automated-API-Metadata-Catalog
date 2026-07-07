// generators/openapi — Phase 0 stub
// Phase 1 implementation: pure function ApiGraph → OpenAPI 3.1 document.
// Snapshot-tested. Generated artifacts are NEVER edited directly by humans.
// No DB access, no LLM calls, no outbound HTTP.

import type { ApiGraph } from '@api-catalog/contracts';

export interface OpenApiDocument {
  openapi: '3.1.0';
  info: { title: string; version: string };
  paths: Record<string, unknown>;
  components?: Record<string, unknown>;
}

/** Pure function: canonical graph in, OpenAPI document out. */
export type GenerateOpenApi = (graph: ApiGraph) => OpenApiDocument;

// Placeholder — full implementation in Phase 1
