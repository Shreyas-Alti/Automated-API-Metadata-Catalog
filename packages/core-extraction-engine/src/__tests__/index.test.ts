import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { runExtraction } from '../index';

// packages/core-extraction-engine/src/__tests__ → ../../.. → packages/
const GOLDEN_FIXTURE = path.join(
  __dirname,
  '../../..',
  'parsers',
  'express',
  'src',
  '__golden__',
  'fixtures',
  'simple-express-app',
);

describe('runExtraction — integration: simple-express-app fixture', () => {
  it('produces a run with status=review_required', async () => {
    const output = await runExtraction({
      repositoryUrl: 'https://github.com/test/simple-express-app',
      commitSha: 'abc123',
      parserName: 'express',
      localRepoPath: GOLDEN_FIXTURE,
    });
    expect(output.run.status).toBe('review_required');
  });

  it('produces an OpenAPI 3.1.0 document', async () => {
    const output = await runExtraction({
      repositoryUrl: 'https://github.com/test/simple-express-app',
      commitSha: 'abc123',
      parserName: 'express',
      localRepoPath: GOLDEN_FIXTURE,
    });
    expect(output.openApiDocument.openapi).toBe('3.1.0');
    expect(Object.keys(output.openApiDocument.paths).length).toBeGreaterThan(0);
  });

  it('canonical graph contains endpoints matching the extracted routes', async () => {
    const output = await runExtraction({
      repositoryUrl: 'https://github.com/test/simple-express-app',
      commitSha: 'abc123',
      parserName: 'express',
      localRepoPath: GOLDEN_FIXTURE,
    });
    expect(output.graph.endpoints.length).toBeGreaterThan(0);
    const methods = output.graph.endpoints.map((e) => e.method);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
  });

  it('throws for an unknown parser', async () => {
    await expect(
      runExtraction({
        repositoryUrl: 'https://github.com/test/repo',
        commitSha: 'abc',
        parserName: 'fastapi',
        localRepoPath: GOLDEN_FIXTURE,
      }),
    ).rejects.toThrow(/No parser registered/);
  });

  it('throws for a non-existent repo path', async () => {
    await expect(
      runExtraction({
        repositoryUrl: 'https://github.com/test/repo',
        commitSha: 'abc',
        parserName: 'express',
        localRepoPath: '/non/existent/path/that/does/not/exist',
      }),
    ).rejects.toThrow();
  });
});

describe('runExtraction — unit: empty repo (no routes)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-engine-test-'));
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { express: '^4.18.0' } }),
    );
  });

  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  it('succeeds with zero endpoints when repo has no Express routes', async () => {
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), `const x = 1;`);
    const output = await runExtraction({
      repositoryUrl: 'file://test',
      commitSha: 'sha',
      parserName: 'express',
      localRepoPath: tmpDir,
    });
    expect(output.run.status).toBe('review_required');
    expect(output.graph.endpoints).toHaveLength(0);
  });
});
