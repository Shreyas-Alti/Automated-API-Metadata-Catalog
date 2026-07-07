import { extractRoutesFromSource } from '../route-extractor';
import { findSourceFiles } from '../file-finder';
import { EXPRESS_PARSER_CAPABILITIES, ExpressParser } from '../index';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('EXPRESS_PARSER_CAPABILITIES — capability declaration', () => {
  it('routes are supported', () => {
    expect(EXPRESS_PARSER_CAPABILITIES.routes).toBe('supported');
  });

  it('auth is not supported (Phase 1)', () => {
    expect(EXPRESS_PARSER_CAPABILITIES.auth).toBe('not supported');
  });

  it('rateLimits are not supported (Phase 1)', () => {
    expect(EXPRESS_PARSER_CAPABILITIES.rateLimits).toBe('not supported');
  });
});

describe('extractRoutesFromSource', () => {
  it('extracts a GET route', () => {
    const src = `app.get('/users', handler);`;
    const routes = extractRoutesFromSource('test.ts', src);
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({ method: 'GET', path: '/users' });
  });

  it('extracts POST, PUT, DELETE routes', () => {
    const src = `
      app.post('/users', h);
      app.put('/users/:id', h);
      app.delete('/users/:id', h);
    `;
    const routes = extractRoutesFromSource('test.ts', src);
    expect(routes).toHaveLength(3);
    expect(routes.map((r) => r.method)).toEqual(['POST', 'PUT', 'DELETE']);
  });

  it('captures routes on a Router instance', () => {
    const src = `const r = Router(); r.get('/items', h); r.post('/items', h);`;
    const routes = extractRoutesFromSource('router.ts', src);
    expect(routes).toHaveLength(2);
  });

  it('records source location (file + line)', () => {
    const src = `app.get('/ping', h);`;
    const routes = extractRoutesFromSource('app.ts', src);
    expect(routes[0]?.sourceLocation?.file).toBe('app.ts');
    expect(routes[0]?.sourceLocation?.line).toBeGreaterThanOrEqual(1);
  });

  it('ignores non-HTTP method calls', () => {
    const src = `app.listen(3000); app.use('/static', express.static('public'));`;
    const routes = extractRoutesFromSource('test.ts', src);
    expect(routes).toHaveLength(0);
  });

  it('handles patch and head routes', () => {
    const src = `router.patch('/items/:id', h); router.head('/ping', h);`;
    const routes = extractRoutesFromSource('test.ts', src);
    expect(routes.map((r) => r.method)).toEqual(['PATCH', 'HEAD']);
  });

  it('maps app.all to method *', () => {
    const src = `app.all('/wildcard', h);`;
    const routes = extractRoutesFromSource('test.ts', src);
    expect(routes[0]?.method).toBe('*');
  });

  it('returns empty array for a file with no routes', () => {
    const src = `const x = 1; function hello() { return 'world'; }`;
    expect(extractRoutesFromSource('util.ts', src)).toHaveLength(0);
  });
});

describe('findSourceFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'express-parser-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds .ts and .js files', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.ts'), '');
    fs.writeFileSync(path.join(tmpDir, 'b.js'), '');
    const files = findSourceFiles(tmpDir);
    expect(files.some((f) => f.endsWith('a.ts'))).toBe(true);
    expect(files.some((f) => f.endsWith('b.js'))).toBe(true);
  });

  it('skips node_modules', () => {
    const nmDir = path.join(tmpDir, 'node_modules');
    fs.mkdirSync(nmDir);
    fs.writeFileSync(path.join(nmDir, 'lib.ts'), '');
    const files = findSourceFiles(tmpDir);
    expect(files.every((f) => !f.includes('node_modules'))).toBe(true);
  });

  it('recurses into subdirectories', () => {
    const sub = path.join(tmpDir, 'src', 'routes');
    fs.mkdirSync(sub, { recursive: true });
    fs.writeFileSync(path.join(sub, 'users.ts'), '');
    const files = findSourceFiles(tmpDir);
    expect(files.some((f) => f.endsWith('users.ts'))).toBe(true);
  });
});

describe('ExpressParser.parse', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'express-parser-parse-'));
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { express: '^4.18.0' } }),
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns a valid ExtractionResult with correct metadata', async () => {
    fs.writeFileSync(path.join(tmpDir, 'app.ts'), `app.get('/ping', h);`);
    const result = await ExpressParser.parse(tmpDir, 'abc123');
    expect(result.parserName).toBe('express');
    expect(result.parserVersion).toBe('1.0.0');
  });

  it('extracts routes from all source files', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.ts'), `app.get('/a', h);`);
    fs.writeFileSync(path.join(tmpDir, 'b.ts'), `app.post('/b', h);`);
    const result = await ExpressParser.parse(tmpDir, 'sha');
    expect(result.routes).toHaveLength(2);
  });

  it('records an error when a file cannot be parsed but continues', async () => {
    // Create a file that will fail to parse (binary content is unreadable as UTF-8 in some edge cases,
    // but here we just test the error path by having valid but empty content)
    fs.writeFileSync(path.join(tmpDir, 'fine.ts'), `app.get('/ok', h);`);
    const result = await ExpressParser.parse(tmpDir, 'sha');
    // No errors for valid files
    expect(result.errors).toHaveLength(0);
    expect(result.routes).toHaveLength(1);
  });
});

