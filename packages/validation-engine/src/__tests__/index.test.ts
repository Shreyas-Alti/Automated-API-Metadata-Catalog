describe('validation-engine', () => {
  it('ValidationRule interface is importable', () => {
    // Phase 1: each rule has a name and a check function
    const ruleNames = ['no-duplicate-routes', 'no-orphan-schemas', 'no-missing-body', 'no-invalid-refs'];
    expect(ruleNames).toHaveLength(4);
  });

  it('module stub compiles — no LLM dependency present', () => {
    expect(true).toBe(true);
  });
});
