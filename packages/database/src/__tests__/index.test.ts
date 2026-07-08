import { PrismaClient, getPrismaClient } from '../index';

describe('@api-catalog/database', () => {
  it('PrismaClient is exported', () => {
    expect(PrismaClient).toBeDefined();
  });

  it('getPrismaClient returns the same singleton instance on repeated calls', () => {
    const a = getPrismaClient();
    const b = getPrismaClient();
    expect(a).toBe(b);
  });
});
