// Quality gate score shape.
// Scoring is per-endpoint, not per-run — a handful of ambiguous endpoints in an
// otherwise-clean extraction only send those few to review, not the whole run.

// Phase 1–2: only 'human-review-required' and 'reject' are valid outcomes.
// 'auto-accept' is enabled in Phase 3 after calibration with production audit-log data.
export type GateOutcome = 'auto-accept' | 'human-review-required' | 'reject';

// Score bands:
//   90–100%  → auto-accept  (Phase 3+ only, with calibration data)
//   70–89%   → human-review-required
//   <70%     → reject
export const SCORE_BAND_AUTO_ACCEPT_MIN = 90;
export const SCORE_BAND_REVIEW_MIN = 70;

// Security fields always route to human-review regardless of score.
// This is hardcoded and permanent — not a threshold to be tuned.
export const SECURITY_FIELDS_ALWAYS_REVIEW = ['auth', 'permissions', 'rateLimit'] as const;
export type SecurityGateField = (typeof SECURITY_FIELDS_ALWAYS_REVIEW)[number];

// Signals computed per run — no ground truth required
export interface QualitySignals {
  // Fraction of files that failed to parse / hit unhandled constructs
  parserErrorRate: number;
  // Fraction of found routes with all required fields populated (method, path, ≥1 response schema)
  fieldCompletenessRatio: number;
  // Static routes vs host-prober live results — large mismatches in either direction are a signal
  crossSourceAgreement?: number;
  // Normalized delta from the previous run on the same repo
  deltaFromPrevious?: number;
}

export interface EndpointQualityScore {
  endpointPath: string;
  endpointMethod: string;
  // 0–100
  score: number;
  outcome: GateOutcome;
  signals: QualitySignals;
  // If true, routes to human-review regardless of score (permanent exception)
  hasSecurityField: boolean;
}

// Per-run summary
export interface RunQualityReport {
  extractionRunId: string;
  endpointScores: EndpointQualityScore[];
  // Phase 1–2: always 'human-review-required' or 'reject' — no auto-accept
  overallOutcome: 'human-review-required' | 'reject';
}
