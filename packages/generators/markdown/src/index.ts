// generators/markdown — Phase 0 stub
// Phase 2 implementation: pure function ApiGraph → Markdown documentation.
// Generated artifacts are NEVER edited directly by humans.
// No DB access, no LLM calls, no outbound HTTP.

import type { ApiGraph } from '@api-catalog/contracts';

export interface MarkdownDocument {
  filename: string;
  content: string;
}

/** Pure function: canonical graph in, Markdown documents out. */
export type GenerateMarkdown = (graph: ApiGraph) => MarkdownDocument[];

// Placeholder — full implementation in Phase 2
