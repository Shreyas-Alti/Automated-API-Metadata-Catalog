import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import {
  registerParser,
  getParser,
  listRegistered,
  detectFramework,
  type IParser,
  type FrameworkName,
} from '../index';
import type { ExtractionResult } from '@api-catalog/contracts';

const makeStubParser = (name: FrameworkName): IParser => ({
  name,
  version: '1.0.0',
  capabilities: {
    routes: 'supported',
    models: 'not supported',
    middleware: 'not supported',
    auth: 'not supported',
    rateLimits: 'not supported',
  },
  parse: async (): Promise<ExtractionResult> => ({
    parserName: name,
    parserVersion: '1.0.0',
    capabilities: {
      routes: 'supported',
      models: 'not supported',
      middleware: 'not supported',
      auth: 'not supported',
      rateLimits: 'not supported',
    },
    routes: [],
    schemas: {},
    errors: [],
    warnings: [],
  }),
});

describe('parser-registry', () => {
  describe('registerParser / getParser', () => {
    it('resolves a registered parser by framework name', () => {
      const stub = makeStubParser('express');
      registerParser('express', stub);
      expect(getParser('express')).toBe(stub);
    });

    it('returns undefined for an unregistered framework', () => {
      expect(getParser('fastapi')).toBeUndefined();
    });

    it('overwrites a previously registered parser', () => {
      const first = makeStubParser('express');
      const second = makeStubParser('express');
      registerParser('express', first);
      registerParser('express', second);
      expect(getParser('express')).toBe(second);
    });
  });

  describe('listRegistered', () => {
    it('includes frameworks that have been registered', () => {
      registerParser('express', makeStubParser('express'));
      expect(listRegistered()).toContain('express');
    });
  });

  describe('detectFramework', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-registry-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('detects express from package.json dependencies', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { express: '^4.18.0' } }),
      );
      expect(detectFramework(tmpDir)).toBe('express');
    });

    it('detects express from devDependencies', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ devDependencies: { express: '^5.0.0' } }),
      );
      expect(detectFramework(tmpDir)).toBe('express');
    });

    it('returns null when no matching framework is found', () => {
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({ dependencies: { react: '^18.0.0' } }),
      );
      expect(detectFramework(tmpDir)).toBeNull();
    });

    it('returns null when package.json does not exist', () => {
      expect(detectFramework(tmpDir)).toBeNull();
    });

    it('returns null when package.json is malformed', () => {
      fs.writeFileSync(path.join(tmpDir, 'package.json'), 'not json');
      expect(detectFramework(tmpDir)).toBeNull();
    });
  });
});

