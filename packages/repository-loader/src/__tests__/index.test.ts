import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  validateRepositoryUrl,
  RepositoryUrlNotAllowedError,
  ALLOWED_GIT_HOSTS,
  detectHeadSha,
  cleanupRepository,
  type CloneResult,
} from '../index';

describe('validateRepositoryUrl', () => {
  it('accepts github.com https URLs', () => {
    const parsed = validateRepositoryUrl('https://github.com/owner/repo');
    expect(parsed.hostname).toBe('github.com');
  });

  it('accepts gitlab.com https URLs', () => {
    expect(() => validateRepositoryUrl('https://gitlab.com/owner/repo')).not.toThrow();
  });

  it('accepts bitbucket.org https URLs', () => {
    expect(() => validateRepositoryUrl('https://bitbucket.org/owner/repo')).not.toThrow();
  });

  it('rejects http:// (non-https)', () => {
    expect(() => validateRepositoryUrl('http://github.com/owner/repo')).toThrow(
      RepositoryUrlNotAllowedError,
    );
  });

  it('rejects git:// protocol', () => {
    expect(() => validateRepositoryUrl('git://github.com/owner/repo')).toThrow(
      RepositoryUrlNotAllowedError,
    );
  });

  it('rejects a private IP as a git host (SSRF)', () => {
    expect(() => validateRepositoryUrl('https://10.0.0.1/owner/repo.git')).toThrow(
      RepositoryUrlNotAllowedError,
    );
  });

  it('rejects an internal hostname not in the allowlist', () => {
    expect(() => validateRepositoryUrl('https://internal-git.company.com/repo')).toThrow(
      RepositoryUrlNotAllowedError,
    );
  });

  it('rejects a malformed URL', () => {
    expect(() => validateRepositoryUrl('not-a-url')).toThrow(RepositoryUrlNotAllowedError);
  });

  it('ALLOWED_GIT_HOSTS contains the expected hosts', () => {
    expect(ALLOWED_GIT_HOSTS.has('github.com')).toBe(true);
    expect(ALLOWED_GIT_HOSTS.has('gitlab.com')).toBe(true);
    expect(ALLOWED_GIT_HOSTS.has('bitbucket.org')).toBe(true);
  });
});

describe('detectHeadSha', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-loader-test-'));
    // Initialize a real git repo with a commit so detectHeadSha works
    const { spawnSync } = require('child_process') as typeof import('child_process'); // eslint-disable-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    spawnSync('git', ['init'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(tmpDir, 'README.md'), '# test');
    spawnSync('git', ['add', '.'], { cwd: tmpDir, stdio: 'pipe' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'pipe' });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns a 40-char hex SHA for a valid git repo', () => {
    const sha = detectHeadSha(tmpDir);
    expect(sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('returns "unknown" for a non-git directory', () => {
    const notARepo = fs.mkdtempSync(path.join(os.tmpdir(), 'not-a-repo-'));
    try {
      expect(detectHeadSha(notARepo)).toBe('unknown');
    } finally {
      fs.rmSync(notARepo, { recursive: true, force: true });
    }
  });
});

describe('cleanupRepository', () => {
  it('removes the directory when ownsDirectory=true', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-test-'));
    const result: CloneResult = { localPath: dir, commitSha: 'abc', ownsDirectory: true };
    cleanupRepository(result);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('does NOT remove the directory when ownsDirectory=false', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-test-'));
    try {
      const result: CloneResult = { localPath: dir, commitSha: 'abc', ownsDirectory: false };
      cleanupRepository(result);
      expect(fs.existsSync(dir)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
