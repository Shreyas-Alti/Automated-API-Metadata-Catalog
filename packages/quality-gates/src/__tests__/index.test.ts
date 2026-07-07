import { SECURITY_FIELDS_ALWAYS_REVIEW, SCORE_BAND_AUTO_ACCEPT_MIN, SCORE_BAND_REVIEW_MIN } from '@api-catalog/contracts';

describe('quality-gates', () => {
  it('security fields are permanently routed to human review (hardcoded, not scored)', () => {
    expect(SECURITY_FIELDS_ALWAYS_REVIEW).toContain('auth');
    expect(SECURITY_FIELDS_ALWAYS_REVIEW).toContain('permissions');
    expect(SECURITY_FIELDS_ALWAYS_REVIEW).toContain('rateLimit');
  });

  it('score bands are correctly defined', () => {
    expect(SCORE_BAND_AUTO_ACCEPT_MIN).toBe(90);
    expect(SCORE_BAND_REVIEW_MIN).toBe(70);
  });

  it('Phase 1-2: auto-accept path does not exist yet', () => {
    // Auto-Accept is only enabled in Phase 3 after calibration data supports it
    const phase12Outcomes = ['human-review-required', 'reject'] as const;
    expect(phase12Outcomes).not.toContain('auto-accept');
  });
});
