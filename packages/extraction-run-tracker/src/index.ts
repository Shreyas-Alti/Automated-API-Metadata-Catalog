import { randomUUID } from 'crypto';
import type { PrismaClient } from '@api-catalog/database';
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

function assertTransitionAllowed(from: ExtractionRunStatus, to: ExtractionRunStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`Invalid transition from '${from}' to '${to}'`);
  }
}

// ─── In-memory implementation (Phase 1 CLI + tests) ──────────────────────────

export class InMemoryExtractionRunTracker implements IExtractionRunTracker {
  private readonly _runs = new Map<string, ExtractionRun>();

  async create(input: Pick<ExtractionRun, 'repositoryUrl' | 'commitSha' | 'parserName' | 'parserVersion'>): Promise<ExtractionRun> {
    const run: ExtractionRun = { id: randomUUID(), ...input, status: 'pending', createdAt: new Date(), updatedAt: new Date() };
    this._runs.set(run.id, run);
    return run;
  }

  async transition(id: string, status: ExtractionRunStatus): Promise<ExtractionRun> {
    const run = this._runs.get(id);
    if (!run) throw new Error(`ExtractionRun not found: ${id}`);
    assertTransitionAllowed(run.status, status);
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

// ─── Prisma implementation (Phase 2 API service) ─────────────────────────────

function rowToRun(row: {
  id: string; repositoryUrl: string; commitSha: string; parserName: string;
  parserVersion: string; status: string; validationSummary: unknown;
  gateOutcome: unknown; createdAt: Date; updatedAt: Date;
}): ExtractionRun {
  return {
    id: row.id,
    repositoryUrl: row.repositoryUrl,
    commitSha: row.commitSha,
    parserName: row.parserName,
    parserVersion: row.parserVersion,
    status: row.status as ExtractionRunStatus,
    validationSummary: row.validationSummary as ValidationSummary | undefined,
    gateOutcome: row.gateOutcome as RunGateOutcome | undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaExtractionRunTracker implements IExtractionRunTracker {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: Pick<ExtractionRun, 'repositoryUrl' | 'commitSha' | 'parserName' | 'parserVersion'>): Promise<ExtractionRun> {
    const row = await this.prisma.extractionRun.create({ data: { ...input, status: 'pending' } });
    return rowToRun(row);
  }

  async transition(id: string, status: ExtractionRunStatus): Promise<ExtractionRun> {
    const existing = await this.prisma.extractionRun.findUnique({ where: { id } });
    if (!existing) throw new Error(`ExtractionRun not found: ${id}`);
    assertTransitionAllowed(existing.status as ExtractionRunStatus, status);
    const row = await this.prisma.extractionRun.update({ where: { id }, data: { status } });
    return rowToRun(row);
  }

  async setValidationSummary(id: string, summary: ValidationSummary): Promise<ExtractionRun> {
    const row = await this.prisma.extractionRun.update({
      where: { id },
      data: { validationSummary: summary as unknown as Parameters<typeof this.prisma.extractionRun.update>[0]['data']['validationSummary'] },
    });
    return rowToRun(row);
  }

  async setGateOutcome(id: string, outcome: RunGateOutcome): Promise<ExtractionRun> {
    const row = await this.prisma.extractionRun.update({
      where: { id },
      data: { gateOutcome: outcome as unknown as Parameters<typeof this.prisma.extractionRun.update>[0]['data']['gateOutcome'] },
    });
    return rowToRun(row);
  }

  async findById(id: string): Promise<ExtractionRun | null> {
    const row = await this.prisma.extractionRun.findUnique({ where: { id } });
    return row ? rowToRun(row) : null;
  }
}


