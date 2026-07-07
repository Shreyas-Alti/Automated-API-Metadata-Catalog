// core-extraction-engine — Phase 0 stub
// Phase 1 implementation: orchestrates one full pipeline run.
// Pipeline: parse → validate → gate → probe → evidence → graph
// Exposed as: CLI command `extract-api --repo <url> --commit <sha> --parser express`
//             and as a TypeScript library imported by worker-service.
// This module does NOT access DB, call LLM, or make HTTP requests directly —
// it delegates to the appropriate boundary modules.

import type { ExtractionRun } from '@api-catalog/contracts';

export interface ExtractionEngineInput {
  repositoryUrl: string;
  commitSha: string;
  parserName: string;
  localRepoPath: string;
  hostUrl?: string;
}

export interface ExtractionEngineOutput {
  run: ExtractionRun;
}

// Placeholder — full orchestration implementation in Phase 1
