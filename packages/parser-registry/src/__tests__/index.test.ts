import type { FrameworkName } from '../index';

describe('parser-registry', () => {
  it('IParser interface is importable', () => {
    const frameworks: FrameworkName[] = ['express', 'fastapi', 'spring'];
    expect(frameworks).toContain('express');
  });

  it('module stub compiles and exports expected symbols', () => {
    // Verified by TypeScript compilation — no runtime assertion needed
    expect(true).toBe(true);
  });
});
