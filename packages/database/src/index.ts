/**
 * @api-catalog/database
 *
 * The ONLY package that directly imports @prisma/client (enforced by dep-cruiser).
 * All other packages that need DB access import PrismaClient from here.
 */
export { PrismaClient } from '@prisma/client';

// Re-export Prisma model types (value imports handled above via PrismaClient)
export type {
  Repository,
  Api,
  Endpoint,
  Auth,
  Response,
  Schema,
  ApiVersion,
  ExtractionRun,
  EvidenceRecord,
  AuditEvent,
  Organisation,
  User,
  Prisma,
} from '@prisma/client';

import { PrismaClient } from '@prisma/client';

let _client: PrismaClient | undefined;

/**
 * Returns a singleton PrismaClient. Call once at application startup.
 * In tests, create a fresh instance per test suite and pass it explicitly.
 */
export function getPrismaClient(): PrismaClient {
  if (!_client) {
    _client = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }
  return _client;
}


