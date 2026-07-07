// ExtractionRun: traceable record of one full pipeline execution.
// Reproducible from (repositoryUrl, commitSha, parserName, parserVersion) alone.

// Status transitions:
//   pending            — job queued, worker not yet picked up (needed because BullMQ
//                        places the job in a queue before any worker processes it;
//                        without this state every run would start as 'running' before
//                        it actually is)
//   running            — worker is actively executing the pipeline
//   parser_error       — plan: ParserError    (terminal)
//   validation_failed  — plan: ValidationFailed (terminal)
//   quality_gate_failed— plan: QualityGateFailed (terminal)
//   review_required    — plan: ReviewRequired   (awaiting human action)
//   published          — plan: Published        (terminal / complete)
//
// The plan names 5 terminal/outcome states; 'pending' and 'running' are the two
// in-progress states added for the job-queue model.  Both are observable in the UI
// and needed by the audit-log and worker-service.  Do not remove them.
export type ExtractionRunStatus =
  | 'pending'
  | 'running'
  | 'parser_error'
  | 'validation_failed'
  | 'quality_gate_failed'
  | 'review_required'
  | 'published';

export interface ValidationError {
  kind: string;
  message: string;
  location?: string;
}

export interface ValidationWarning {
  kind: string;
  message: string;
  location?: string;
}

export interface ValidationSummary {
  passed: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// Per-run gate outcome — individual endpoint scores live on EndpointQualityScore
export interface RunGateOutcome {
  totalEndpoints: number;
  autoAccepted: number;   // always 0 in Phase 1–2; enabled in Phase 3 with calibration data
  reviewRequired: number;
  rejected: number;
}

export interface ExtractionRun {
  id: string;
  repositoryUrl: string;
  commitSha: string;
  parserName: string;
  parserVersion: string;
  status: ExtractionRunStatus;
  validationSummary?: ValidationSummary;
  gateOutcome?: RunGateOutcome;
  createdAt: Date;
  updatedAt: Date;
}
