import { EXPRESS_PARSER_CAPABILITIES } from '../index';

describe('parser-express — capability declaration', () => {
  it('exports a capability declaration object', () => {
    expect(EXPRESS_PARSER_CAPABILITIES).toBeDefined();
  });

  it('routes are supported', () => {
    expect(EXPRESS_PARSER_CAPABILITIES.routes).toBe('supported');
  });

  it('auth is not supported (Phase 1 — must be hardcoded in declaration)', () => {
    expect(EXPRESS_PARSER_CAPABILITIES.auth).toBe('not supported');
  });

  it('rateLimits are not supported (Phase 1)', () => {
    expect(EXPRESS_PARSER_CAPABILITIES.rateLimits).toBe('not supported');
  });
});
