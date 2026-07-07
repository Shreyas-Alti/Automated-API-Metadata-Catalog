// audit-log — Phase 0 stub
// Phase 2 implementation: immutable event log.
// Records:
//   - every human review edit (field changed, old value, new value, reviewer)
//   - every gate decision (score, outcome, which tier, endpoint)
// Used in Phase 3 to calibrate quality-gate thresholds.
// CI-enforced: may access DB; may NOT call LLM or make outbound HTTP requests.

import type { GateOutcome } from '@api-catalog/contracts';

export interface HumanEditEvent {
  kind: 'human-edit';
  extractionRunId: string;
  endpointId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reviewerId: string;
  timestamp: Date;
}

export interface GateDecisionEvent {
  kind: 'gate-decision';
  extractionRunId: string;
  endpointId: string;
  score: number;
  outcome: GateOutcome;
  hasSecurityField: boolean;
  timestamp: Date;
}

export type AuditEvent = HumanEditEvent | GateDecisionEvent;

export interface IAuditLog {
  record(event: AuditEvent): Promise<void>;
  getEvents(extractionRunId: string): Promise<AuditEvent[]>;
  // NOTE: no update(), no delete() — immutable
}
