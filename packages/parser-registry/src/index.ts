// parser-registry — Phase 0 stub
// Phase 1 implementation: plugin contract + factory (detectFramework, loadParser).
// Each parser declares its own capabilities; this registry resolves them.
// CI-enforced: may NOT import a DB client, LLM client, or make outbound HTTP requests.

import type { ExtractionResult, ParserCapabilities } from '@api-catalog/contracts';

/** Minimal plugin interface every parser must satisfy. Full contract defined in Phase 1. */
export interface IParser {
  readonly name: string;
  readonly version: string;
  readonly capabilities: ParserCapabilities;
  parse(repoPath: string, commitSha: string): Promise<ExtractionResult>;
}

export type FrameworkName = 'express' | 'fastapi' | 'spring';
