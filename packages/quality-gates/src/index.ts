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

// ─── Per-route field completeness ────────────────────────────────────────────
//
// Each route is scored on its *own* completeness — not the run average.
// This is the key per-endpoint discriminator: a route with a sourceLocation
// and response schemas defined scores higher than a route with only method+path.
//
// IMPORTANT: checks are capability-aware — we only test for a field's presence
// if the parser declared it can extract that field. Penalising a Phase 1 route
// for having no response schemas when the parser reports
// `capabilities.models = 'not supported'` would unfairly reject clean runs.
//
// Run-level signals (parserErrorRate, crossSourceAgreement, deltaFromPrevious)
// are shared context applied uniformly.

import type { ParserCapabilities } from '@api-catalog/contracts';

/**
 * Compute 0–1 field completeness for ONE route, conditional on what the parser
 * declared it can extract.
 *
 * This is what makes scores differ *between* endpoints in the same run.
 */
function computePerRouteCompleteness(
  route: ExtractionResult['routes'][number],
  capabilities: ParserCapabilities,
): number {
  const checks: boolean[] = [];

  // sourceLocation — always applicable: the parser either found it in source or didn't
  checks.push(Boolean(route.sourceLocation));

  // Response schemas — only applies when parser supports model/response extraction
  if (capabilities.models !== 'not supported') {
    checks.push((route.responses?.length ?? 0) > 0);
  }

  // requestBody — only applies when parser supports middleware/body extraction
  const needsBody = ['POST', 'PUT', 'PATCH'].includes(route.method.toUpperCase());
  if (capabilities.middleware !== 'not supported' && needsBody) {
    checks.push(Boolean(route.requestBody));
  }

  if (checks.length === 0) return 1; // no applicable checks — treat as complete
  return checks.filter(Boolean).length / checks.length;
}

// ─── Score formula ────────────────────────────────────────────────────────────

interface RunLevelSignals {
  parserErrorRate: number;
  crossSourceAgreement?: number;
  deltaFromPrevious?: number;
}

/**
 * Combine per-route completeness with run-level signals into a 0–100 score.
 *
 * Weights:
 *   per-route completeness : 50 pts  (main discriminator between endpoints)
 *   cross-source agreement : 20 pts  (run-level, neutral if no probe data)
 *   parser error rate      : -30 pts penalty (run-level)
 *   large delta penalty    : -15 pts if route count swung >50% vs previous run
 */
function computeScore(
  runSignals: RunLevelSignals,
  routeFieldCompleteness: number,
): number {
  const completenessScore = routeFieldCompleteness * 50;
  const errorPenalty = runSignals.parserErrorRate * 30;
  const crossSourceScore = (runSignals.crossSourceAgreement ?? 1) * 20;

  let score = completenessScore + crossSourceScore - errorPenalty;

  if (runSignals.deltaFromPrevious !== undefined && runSignals.deltaFromPrevious > 0.5) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Determine gate outcome from score. In Phase 1–2, auto-accept is never emitted. */
function scoreToOutcome(score: number, hasSecurityField: boolean): GateOutcome {
  // Permanent exception: security fields always go to human review
  if (hasSecurityField) return 'human-review-required';

  // Phase 1–2: auto-accept path disabled
  if (score >= SCORE_BAND_AUTO_ACCEPT_MIN) return 'human-review-required';
  if (score >= SCORE_BAND_REVIEW_MIN) return 'human-review-required';
  return 'reject';
}

function endpointHasSecurityField(route: ExtractionResult['routes'][number]): boolean {
  const secFields = SECURITY_FIELDS_ALWAYS_REVIEW as readonly string[];
  if ((route.security?.length ?? 0) > 0) return true;
  if (route.rateLimit !== undefined) return true;
  for (const p of route.parameters ?? []) {
    if (secFields.some((f) => p.name.toLowerCase().includes(f))) return true;
  }
  return false;
}

/**
 * Compute per-endpoint quality scores and produce a RunQualityReport.
 *
 * Each endpoint receives its own score based on its own field completeness
 * plus shared run-level context (parser error rate, cross-source agreement,
 * delta from previous run). Two endpoints in the same run CAN and SHOULD
 * receive different scores — that is the point of per-endpoint scoring.
 *
 * Phase 1–2: overallOutcome is always 'human-review-required' or 'reject'.
 * Auto-accept is only enabled in Phase 3 after calibration data supports it.
 */
export function computeQualityGate(input: GateInput): RunQualityReport {
  const { extractionResult, validationSummary, previousRunRouteCount, liveRouteCount } = input;

  // ── Run-level signals (shared context, not per-endpoint scores) ──────────
  const totalFiles = Math.max(
    extractionResult.errors.length + extractionResult.routes.length,
    1,
  );
  const parserErrorRate = extractionResult.errors.length / totalFiles;

  const routeCount = extractionResult.routes.length;

  const crossSourceAgreement =
    liveRouteCount !== undefined && routeCount > 0
      ? 1 - Math.abs(routeCount - liveRouteCount) / Math.max(routeCount, liveRouteCount)
      : undefined;

  const deltaFromPrevious =
    previousRunRouteCount !== undefined && previousRunRouteCount > 0
      ? Math.abs(routeCount - previousRunRouteCount) / previousRunRouteCount
      : undefined;

  const runSignals: RunLevelSignals = { parserErrorRate, crossSourceAgreement, deltaFromPrevious };

  // ── Per-endpoint scoring ─────────────────────────────────────────────────
  const endpointScores: EndpointQualityScore[] = extractionResult.routes.map((route) => {
    // Each endpoint's completeness is computed from ITS OWN fields,
    // conditioned on what the parser declared it can extract
    const perRouteCompleteness = computePerRouteCompleteness(
      route,
      extractionResult.capabilities,
    );
    const hasSecurityField = endpointHasSecurityField(route);

    // Each endpoint's QualitySignals reflects ITS OWN completeness
    const signals: QualitySignals = {
      parserErrorRate,
      fieldCompletenessRatio: perRouteCompleteness,   // ← per-route, not run average
      crossSourceAgreement,
      deltaFromPrevious,
    };

    const score = computeScore(runSignals, perRouteCompleteness);

    return {
      endpointPath: route.path,
      endpointMethod: route.method,
      score,
      outcome: scoreToOutcome(score, hasSecurityField),
      signals,
      hasSecurityField,
    };
  });

  // Validation errors always drive overall outcome to reject
  const hasValidationErrors = !validationSummary.passed;
  const anyRejected = endpointScores.some((s) => s.outcome === 'reject') || hasValidationErrors;

  const overallOutcome: RunQualityReport['overallOutcome'] = anyRejected
    ? 'reject'
    : 'human-review-required';

  return {
    extractionRunId: '',
    endpointScores,
    overallOutcome,
  };
}

export type { RunQualityReport, EndpointQualityScore };


