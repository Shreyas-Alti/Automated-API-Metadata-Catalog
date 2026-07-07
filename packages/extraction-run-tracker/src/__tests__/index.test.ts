import { InMemoryExtractionRunTracker } from '../index';

describe('InMemoryExtractionRunTracker', () => {
  let tracker: InMemoryExtractionRunTracker;

  beforeEach(() => { tracker = new InMemoryExtractionRunTracker(); });

  it('creates a run with status=pending', async () => {
    const run = await tracker.create({ repositoryUrl: 'https://github.com/x/y', commitSha: 'abc', parserName: 'express', parserVersion: '1.0.0' });
    expect(run.status).toBe('pending');
    expect(run.id).toBeTruthy();
  });

  it('transitions pending → running', async () => {
    const run = await tracker.create({ repositoryUrl: 'https://github.com/x/y', commitSha: 'abc', parserName: 'express', parserVersion: '1.0.0' });
    const updated = await tracker.transition(run.id, 'running');
    expect(updated.status).toBe('running');
  });

  it('transitions running → review_required', async () => {
    const run = await tracker.create({ repositoryUrl: 'https://github.com/x/y', commitSha: 'abc', parserName: 'express', parserVersion: '1.0.0' });
    await tracker.transition(run.id, 'running');
    const final = await tracker.transition(run.id, 'review_required');
    expect(final.status).toBe('review_required');
  });

  it('rejects invalid transitions', async () => {
    const run = await tracker.create({ repositoryUrl: 'https://github.com/x/y', commitSha: 'abc', parserName: 'express', parserVersion: '1.0.0' });
    await expect(tracker.transition(run.id, 'published')).rejects.toThrow(/Invalid transition/);
  });

  it('terminal states cannot be transitioned away from', async () => {
    const run = await tracker.create({ repositoryUrl: 'https://github.com/x/y', commitSha: 'abc', parserName: 'express', parserVersion: '1.0.0' });
    await tracker.transition(run.id, 'running');
    await tracker.transition(run.id, 'parser_error');
    await expect(tracker.transition(run.id, 'running')).rejects.toThrow(/Invalid transition/);
  });

  it('setValidationSummary attaches summary to the run', async () => {
    const run = await tracker.create({ repositoryUrl: 'https://github.com/x/y', commitSha: 'abc', parserName: 'express', parserVersion: '1.0.0' });
    const updated = await tracker.setValidationSummary(run.id, { passed: true, errors: [], warnings: [] });
    expect(updated.validationSummary?.passed).toBe(true);
  });

  it('findById returns null for unknown id', async () => {
    expect(await tracker.findById('non-existent')).toBeNull();
  });
});
