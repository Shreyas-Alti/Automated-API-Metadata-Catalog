import { randomUUID } from 'crypto';
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

// Allowed transitions map — enforces the state machine
const ALLOWED_TRANSITIONS: Record<ExtractionRunStatus, ExtractionRunStatus[]> = {
  pending:              ['running'],
  running:              ['parser_error', 'validation_failed', 'quality_gate_failed', 'review_required', 'published'],
  parser_error:         [],
  validation_failed:    [],
  quality_gate_failed:  [],
  review_required:      ['published'],
  published:            [],
};

/** In-memory implementation — no database required for Phase 1 CLI. */
export class InMemoryExtractionRunTracker implements IExtractionRunTracker {
  private readonly _runs = new Map<string, ExtractionRun>();

  async create(
    input: Pick<ExtractionRun, 'repositoryUrl' | 'commitSha' | 'parserName' | 'parserVersion'>,
  ): Promise<ExtractionRun> {
    const run: ExtractionRun = {
      id: randomUUID(),
      ...input,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this._runs.set(run.id, run);
    return run;
  }

  async transition(id: string, status: ExtractionRunStatus): Promise<ExtractionRun> {
    const run = this._runs.get(id);
    if (!run) throw new Error(`ExtractionRun not found: ${id}`);

    const allowed = ALLOWED_TRANSITIONS[run.status];
    if (!allowed.includes(status)) {
      throw new Error(
        `Invalid transition from '${run.status}' to '${status}'`,
      );
    }

    const updated: ExtractionRun = { ...run, status, updatedAt: new Date() };
    this._runs.set(id, updated);
    return updated;
  }

  async setValidationSummary(id: string, summary: ValidationSummary): Promise<ExtractionRun> {
    const run = this._runs.get(id);
    if (!run) throw new Error(`ExtractionRun not found: ${id}`);
    const updated = { ...run, validationSummary: summary, updatedAt: new Date() };
    this._runs.set(id, updated);
    return updated;
  }

  async setGateOutcome(id: string, outcome: RunGateOutcome): Promise<ExtractionRun> {
    const run = this._runs.get(id);
    if (!run) throw new Error(`ExtractionRun not found: ${id}`);
    const updated = { ...run, gateOutcome: outcome, updatedAt: new Date() };
    this._runs.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<ExtractionRun | null> {
    return this._runs.get(id) ?? null;
  }
}

