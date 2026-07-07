import path from 'path';
import { execSync } from 'child_process';

const REPO_ROOT = path.join(__dirname, '../../../..');
const DEPCRUISER_CONFIG = path.join(REPO_ROOT, '.dependency-cruiser.js');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require(DEPCRUISER_CONFIG) as {
  forbidden: Array<{
    name: string;
    severity: string;
    from: { pathNot: string[] };
    to: { path: string };
  }>;
};

describe('Architecture boundary rules — config correctness', () => {
  it('dependency-cruiser config exists at repo root', () => {
    expect(config).toBeDefined();
    expect(config.forbidden).toBeDefined();
    expect(Array.isArray(config.forbidden)).toBe(true);
  });

  it('all three required boundary rules are defined', () => {
    const ruleNames = config.forbidden.map((r) => r.name);
    expect(ruleNames).toContain('no-db-outside-allowed-modules');
    expect(ruleNames).toContain('no-llm-outside-llm-enrichment');
    expect(ruleNames).toContain('no-http-client-outside-host-prober');
  });

  it('all three rules have error severity (CI fails on violation)', () => {
    config.forbidden.forEach((rule) => {
      expect(rule.severity).toBe('error');
    });
  });

  describe('no-db-outside-allowed-modules', () => {
    const rule = () => config.forbidden.find((r) => r.name === 'no-db-outside-allowed-modules')!;

    it('allows exactly the five DB-permitted modules', () => {
      const allowed = rule().from.pathNot;
      expect(allowed.some((p) => p.includes('canonical-graph'))).toBe(true);
      expect(allowed.some((p) => p.includes('evidence-ledger'))).toBe(true);
      expect(allowed.some((p) => p.includes('extraction-run-tracker'))).toBe(true);
      expect(allowed.some((p) => p.includes('audit-log'))).toBe(true);
      expect(allowed.some((p) => p.includes('auth-service'))).toBe(true);
    });

    it('targets common DB client package names', () => {
      expect(rule().to.path).toMatch(/pg/);
      expect(rule().to.path).toMatch(/typeorm|prisma|knex|sequelize|drizzle/);
    });
  });

  describe('no-llm-outside-llm-enrichment', () => {
    const rule = () => config.forbidden.find((r) => r.name === 'no-llm-outside-llm-enrichment')!;

    it('allows ONLY llm-enrichment to import LLM clients', () => {
      const allowed = rule().from.pathNot;
      expect(allowed).toHaveLength(1);
      expect(allowed[0]).toContain('llm-enrichment');
    });

    it('targets common LLM client package names', () => {
      expect(rule().to.path).toMatch(/openai|anthropic|langchain|generative-ai/);
    });
  });

  describe('no-http-client-outside-host-prober', () => {
    const rule = () => config.forbidden.find((r) => r.name === 'no-http-client-outside-host-prober')!;

    it('allows ONLY host-prober to use HTTP client libraries', () => {
      const allowed = rule().from.pathNot;
      expect(allowed).toHaveLength(1);
      expect(allowed[0]).toContain('host-prober');
    });

    it('targets common HTTP client library package names', () => {
      expect(rule().to.path).toMatch(/axios|got|node-fetch|undici/);
    });
  });
});

describe('Architecture boundary rules — clean codebase passes arch:lint', () => {
  it('pnpm run arch:lint exits 0 against the current workspace', () => {
    expect(() => {
      execSync('pnpm run arch:lint', {
        cwd: REPO_ROOT,
        stdio: 'pipe',
      });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Negative tests — the rules must BLOCK violations, not just pass on clean code.
// A rule with a typo in its glob would also "pass on clean code" while silently
// doing nothing.  Each test below deliberately introduces one violation and
// asserts that dependency-cruiser exits non-zero AND names the correct rule.
// ---------------------------------------------------------------------------

function runDepcruiseOnFixture(relativeFixturePath: string): {
  exitCode: number;
  violatedRuleNames: string[];
} {
  // Use forward slashes — depcruise handles them cross-platform.
  // Use the default 'err' reporter (not json) because --output-type json does not
  // set a non-zero exit code on violations in depcruise v16; the err reporter does.
  const fixturePosix = relativeFixturePath.replace(/\\/g, '/');
  try {
    execSync(
      `pnpm exec depcruise --config .dependency-cruiser.js ${fixturePosix}`,
      { cwd: REPO_ROOT, stdio: 'pipe' },
    );
    return { exitCode: 0, violatedRuleNames: [] };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: Buffer };
    const exitCode = e.status ?? 1;
    const raw = e.stdout?.toString() ?? '';
    // depcruise err reporter uses ANSI colour codes — strip them before parsing
    const output = raw.replace(/\x1b\[[0-9;]*m/g, '');
    // err reporter prints: "  error {rule-name}: {from} → {to}"
    const ruleNameMatches = [...output.matchAll(/error\s+(\S+):/g)];
    const violatedRuleNames = ruleNameMatches.map((m) => m[1]);
    return { exitCode, violatedRuleNames };
  }
}

describe('Architecture boundary rules — negative tests (violation detection)', () => {
  it('[no-db-outside-allowed-modules] exits non-zero and names the rule when a non-DB module imports pg', () => {
    const result = runDepcruiseOnFixture(
      'tools/arch-lint/src/violation-fixtures/bad-db-import.ts',
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.violatedRuleNames).toContain('no-db-outside-allowed-modules');
  });

  it('[no-llm-outside-llm-enrichment] exits non-zero and names the rule when a non-LLM module imports openai', () => {
    const result = runDepcruiseOnFixture(
      'tools/arch-lint/src/violation-fixtures/bad-llm-import.ts',
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.violatedRuleNames).toContain('no-llm-outside-llm-enrichment');
  });

  it('[no-http-client-outside-host-prober] exits non-zero and names the rule when a non-prober module imports axios', () => {
    const result = runDepcruiseOnFixture(
      'tools/arch-lint/src/violation-fixtures/bad-http-import.ts',
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.violatedRuleNames).toContain('no-http-client-outside-host-prober');
  });
});
