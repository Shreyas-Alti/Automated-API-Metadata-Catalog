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
  EndpointQualityScore,
  RunQualityReport,
  QualitySignals,
  GateOutcome,
} from '@api-catalog/contracts';
import {
  SCORE_BAND_AUTO_ACCEPT_MIN,
  SCORE_BAND_REVIEW_MIN,
  SECURITY_FIELDS_ALWAYS_REVIEW,
} from '@api-catalog/contracts';

export interface GateInput {
  extractionResult: ExtractionResult;
  validationSummary: ValidationSummary;
  /** Route count from a previous run on the same repo, for delta computation. */
  previousRunRouteCount?: number;
  /** Route count reported by host-prober for cross-source agreement. */
  liveRouteCount?: number;
}

/** Compute a 0–100 quality score from the given signals. */
function computeScore(signals: QualitySignals): number {
  // Weights:  completeness 50%, parser error rate 30%, cross-source 20%
  const completenessScore = signals.fieldCompletenessRatio * 50;
  const errorPenalty = signals.parserErrorRate * 30;
  const crossSourceScore =
    signals.crossSourceAgreement !== undefined
      ? signals.crossSourceAgreement * 20
      : 20; // no cross-source data → assume neutral (no penalty)

  let score = completenessScore + crossSourceScore - errorPenalty;

  // Apply delta penalty if route count changed dramatically (>50% swing)
  if (signals.deltaFromPrevious !== undefined && signals.deltaFromPrevious > 0.5) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Determine gate outcome from score. In Phase 1–2, auto-accept is never emitted. */
function scoreToOutcome(score: number, hasSecurityField: boolean): GateOutcome {
  // Permanent exception: security fields always go to human review
  if (hasSecurityField) return 'human-review-required';

  // Phase 1–2: auto-accept path disabled — even 90+ routes to human-review
  if (score >= SCORE_BAND_AUTO_ACCEPT_MIN) return 'human-review-required';
  if (score >= SCORE_BAND_REVIEW_MIN) return 'human-review-required';
  return 'reject';
}

function endpointHasSecurityField(route: ExtractionResult['routes'][number]): boolean {
  const secFields = SECURITY_FIELDS_ALWAYS_REVIEW as readonly string[];
  if ((route.security?.length ?? 0) > 0) return true;
  if (route.rateLimit !== undefined) return true;
  // Check if any parameter name matches a security field
  for (const p of route.parameters ?? []) {
    if (secFields.some((f) => p.name.toLowerCase().includes(f))) return true;
  }
  return false;
}

/**
 * Compute per-endpoint quality scores and produce a RunQualityReport.
 *
 * Phase 1–2: overallOutcome is always 'human-review-required' or 'reject'.
 * Auto-accept will only be enabled in Phase 3 after calibration data supports it.
 */
export function computeQualityGate(input: GateInput): RunQualityReport {
  const { extractionResult, validationSummary, previousRunRouteCount, liveRouteCount } = input;

  const totalFiles = Math.max(
    extractionResult.errors.length + extractionResult.routes.length,
    1,
  );
  const parserErrorRate = extractionResult.errors.length / totalFiles;

  const routeCount = extractionResult.routes.length;
  const routesWithRequiredFields = extractionResult.routes.filter(
    (r) => r.method && r.path,
  ).length;
  const fieldCompletenessRatio = routeCount === 0 ? 1 : routesWithRequiredFields / routeCount;

  const crossSourceAgreement =
    liveRouteCount !== undefined && routeCount > 0
      ? 1 - Math.abs(routeCount - liveRouteCount) / Math.max(routeCount, liveRouteCount)
      : undefined;

  const deltaFromPrevious =
    previousRunRouteCount !== undefined && previousRunRouteCount > 0
      ? Math.abs(routeCount - previousRunRouteCount) / previousRunRouteCount
      : undefined;

  const baseSignals: QualitySignals = {
    parserErrorRate,
    fieldCompletenessRatio,
    crossSourceAgreement,
    deltaFromPrevious,
  };

  const endpointScores: EndpointQualityScore[] = extractionResult.routes.map((route) => {
    const hasSecurityField = endpointHasSecurityField(route);
    const score = computeScore(baseSignals);
    return {
      endpointPath: route.path,
      endpointMethod: route.method,
      score,
      outcome: scoreToOutcome(score, hasSecurityField),
      signals: baseSignals,
      hasSecurityField,
    };
  });

  // Validation errors drive the overall outcome to reject
  const hasValidationErrors = !validationSummary.passed;
  const anyRejected = endpointScores.some((s) => s.outcome === 'reject') || hasValidationErrors;

  const overallOutcome: RunQualityReport['overallOutcome'] = anyRejected
    ? 'reject'
    : 'human-review-required';

  return {
    extractionRunId: '', // set by the caller
    endpointScores,
    overallOutcome,
  };
}

export type { RunQualityReport, EndpointQualityScore };

