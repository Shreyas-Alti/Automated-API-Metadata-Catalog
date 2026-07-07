import type { IExtractionRunTracker, ExtractionRunStatus } from '../index';

describe('extraction-run-tracker', () => {
  it('IExtractionRunTracker exposes status transition methods', () => {
    const methods: Array<keyof IExtractionRunTracker> = [
      'create',
      'transition',
      'setValidationSummary',
      'setGateOutcome',
      'findById',
    ];
    expect(methods).toHaveLength(5);
  });

  it('all valid status transitions are typed', () => {
    const validStatuses: ExtractionRunStatus[] = [
      'pending',
      'running',
      'parser_error',
      'validation_failed',
      'quality_gate_failed',
      'review_required',
      'published',
    ];
    expect(validStatuses).toHaveLength(7);
  });
});
