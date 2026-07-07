// extraction-run-tracker — Phase 0 stub
// Phase 1 implementation: ExtractionRun entity + explicit status transitions.
// Allowed transitions:
//   pending → running → parser_error
//                     → validation_failed
//                     → quality_gate_failed
//                     → review_required
//                     → published
// CI-enforced: may access DB; may NOT call LLM or make outbound HTTP requests.

import type {
  ExtractionRun,
  ExtractionRunStatus,
  ValidationSummary,
  RunGateOutcome,
} from '@api-catalog/contracts';

export interface IExtractionRunTracker {
  create(
    input: Pick<ExtractionRun, 'repositoryUrl' | 'commitSha' | 'parserName' | 'parserVersion'>,
  ): Promise<ExtractionRun>;
  transition(id: string, status: ExtractionRunStatus): Promise<ExtractionRun>;
  setValidationSummary(id: string, summary: ValidationSummary): Promise<ExtractionRun>;
  setGateOutcome(id: string, outcome: RunGateOutcome): Promise<ExtractionRun>;
  findById(id: string): Promise<ExtractionRun | null>;
}

export type { ExtractionRun, ExtractionRunStatus };
