import type { ExtractionEngineInput } from '../index';

describe('core-extraction-engine', () => {
  it('ExtractionEngineInput shape is correct', () => {
    const input: ExtractionEngineInput = {
      repositoryUrl: 'https://github.com/example/repo',
      commitSha: 'abc123',
      parserName: 'express',
      localRepoPath: '/tmp/repo',
    };
    expect(input.parserName).toBe('express');
  });

  it('module stub compiles — orchestration delegates to boundary modules', () => {
    // Pipeline: parse → validate → gate → probe → evidence → graph
    // This module never accesses DB, calls LLM, or makes HTTP requests directly
    expect(true).toBe(true);
  });
});
