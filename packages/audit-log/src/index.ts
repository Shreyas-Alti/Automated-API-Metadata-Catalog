// audit-log — Phase 2 implementation: immutable event log.
// CI-enforced: may access DB; may NOT call LLM or make outbound HTTP requests.

import type { PrismaClient } from '@api-catalog/database';
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

/** Append-only interface — no update(), no delete(). */
export interface IAuditLog {
  record(event: AuditEvent): Promise<void>;
  getEvents(extractionRunId: string): Promise<AuditEvent[]>;
}

// ─── In-memory implementation (Phase 1 CLI + tests) ──────────────────────────

export class InMemoryAuditLog implements IAuditLog {
  private readonly _events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this._events.push({ ...event });
  }

  async getEvents(extractionRunId: string): Promise<AuditEvent[]> {
    return this._events.filter((e) => e.extractionRunId === extractionRunId);
  }
}

// ─── Prisma implementation (Phase 2 API service) ─────────────────────────────

export class PrismaAuditLog implements IAuditLog {
  constructor(private readonly prisma: PrismaClient) {}

  async record(event: AuditEvent): Promise<void> {
    if (event.kind === 'human-edit') {
      await this.prisma.auditEvent.create({
        data: {
          kind: 'human-edit',
          extractionRunId: event.extractionRunId,
          endpointId: event.endpointId,
          field: event.field,
          oldValue: event.oldValue !== undefined ? (event.oldValue as Parameters<typeof this.prisma.auditEvent.create>[0]['data']['oldValue']) : undefined,
          newValue: event.newValue !== undefined ? (event.newValue as Parameters<typeof this.prisma.auditEvent.create>[0]['data']['newValue']) : undefined,
          reviewerId: event.reviewerId,
          timestamp: event.timestamp,
        },
      });
    } else {
      await this.prisma.auditEvent.create({
        data: {
          kind: 'gate-decision',
          extractionRunId: event.extractionRunId,
          endpointId: event.endpointId,
          score: event.score,
          outcome: event.outcome,
          hasSecurityField: event.hasSecurityField,
          timestamp: event.timestamp,
        },
      });
    }
  }

  async getEvents(extractionRunId: string): Promise<AuditEvent[]> {
    const rows = await this.prisma.auditEvent.findMany({
      where: { extractionRunId },
      orderBy: { timestamp: 'asc' },
    });

    return rows.map((row): AuditEvent => {
      if (row.kind === 'human-edit') {
        return {
          kind: 'human-edit',
          extractionRunId: row.extractionRunId,
          endpointId: row.endpointId,
          field: row.field ?? '',
          oldValue: row.oldValue,
          newValue: row.newValue,
          reviewerId: row.reviewerId ?? '',
          timestamp: row.timestamp,
        };
      }
      return {
        kind: 'gate-decision',
        extractionRunId: row.extractionRunId,
        endpointId: row.endpointId,
        score: row.score ?? 0,
        outcome: (row.outcome ?? 'human-review-required') as GateOutcome,
        hasSecurityField: row.hasSecurityField ?? false,
        timestamp: row.timestamp,
      };
    });
  }
}

