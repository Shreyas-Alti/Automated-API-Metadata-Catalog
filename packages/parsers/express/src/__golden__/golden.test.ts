import * as path from 'path';
import { ExpressParser } from '../index';

const FIXTURE_DIR = path.join(
  __dirname,
  'fixtures',
  'simple-express-app',
);

// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
const expected = require('./fixtures/simple-express-app/expected.json') as {
  routeCount: number;
  routes: Array<{ method: string; path: string }>;
};

describe('parsers/express — golden-repo: simple-express-app', () => {
  let result: Awaited<ReturnType<typeof ExpressParser.parse>>;

  beforeAll(async () => {
    result = await ExpressParser.parse(FIXTURE_DIR, 'golden-test-sha');
  });

  it('produces zero parse errors', () => {
    expect(result.errors).toHaveLength(0);
  });

  it(`extracts exactly ${expected.routeCount} routes`, () => {
    expect(result.routes).toHaveLength(expected.routeCount);
  });

  it('extracts every expected (method, path) pair', () => {
    for (const exp of expected.routes) {
      const found = result.routes.some(
        (r) => r.method === exp.method && r.path === exp.path,
      );
      expect(found).toBe(true);
    }
  });

  it('all extracted routes have a sourceLocation', () => {
    for (const route of result.routes) {
      expect(route.sourceLocation).toBeDefined();
      expect(typeof route.sourceLocation?.file).toBe('string');
      expect(typeof route.sourceLocation?.line).toBe('number');
    }
  });

  it('parser metadata matches declared capability', () => {
    expect(result.parserName).toBe('express');
    expect(result.parserVersion).toBe('1.0.0');
    expect(result.capabilities.routes).toBe('supported');
    expect(result.capabilities.auth).toBe('not supported');
    expect(result.capabilities.rateLimits).toBe('not supported');
  });
});
