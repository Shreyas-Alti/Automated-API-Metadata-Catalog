// quality-gates — Phase 0 stub
// Phase 1 implementation: per-endpoint quality scoring.
// Phase 1–2: outputs Human Review Required or Reject only. Auto-Accept path does NOT exist.
// Scores are computed and stored even in Phase 1–2 to build calibration data for Phase 3.
// Permanent hardcoded exception: security fields (auth, permissions, rateLimit) always
// route to Human Review regardless of score, even at 95%+.
// CI-enforced: no DB client, no LLM client, no outbound HTTP.

import type {
  ExtractionResult,
  ValidationSummary,
} from '@api-catalog/contracts';

export interface GateInput {
  extractionResult: ExtractionResult;
  validationSummary: ValidationSummary;
  previousRunRouteCount?: number;
  liveRouteCount?: number;
}

// Placeholder — full scoring implementation in Phase 1
// RunQualityReport and EndpointQualityScore are re-exported from contracts for convenience
export type { RunQualityReport, EndpointQualityScore } from '@api-catalog/contracts';
