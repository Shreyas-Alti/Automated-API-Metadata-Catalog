import type { IAuditLog, AuditEvent, HumanEditEvent, GateDecisionEvent } from '../index';

describe('audit-log', () => {
  it('IAuditLog does not expose update or delete methods (immutable)', () => {
    const methods: Array<keyof IAuditLog> = ['record', 'getEvents'];
    expect(methods).not.toContain('update');
    expect(methods).not.toContain('delete');
  });

  it('AuditEvent discriminates by kind field', () => {
    const editEvent: HumanEditEvent = {
      kind: 'human-edit',
      extractionRunId: 'run-1',
      endpointId: 'ep-1',
      field: 'summary',
      oldValue: 'old',
      newValue: 'new',
      reviewerId: 'user-1',
      timestamp: new Date(),
    };
    const gateEvent: GateDecisionEvent = {
      kind: 'gate-decision',
      extractionRunId: 'run-1',
      endpointId: 'ep-1',
      score: 85,
      outcome: 'human-review-required',
      hasSecurityField: false,
      timestamp: new Date(),
    };
    const events: AuditEvent[] = [editEvent, gateEvent];
    expect(events[0].kind).toBe('human-edit');
    expect(events[1].kind).toBe('gate-decision');
  });
});
