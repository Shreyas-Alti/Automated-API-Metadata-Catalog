import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { generateOpenApi } from '@api-catalog/generator-openapi';
import type { ApiGraph } from '@api-catalog/contracts';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(organisationId: string) {
    const versions = await this.prisma.apiVersion.findMany({
      where: { publishedAt: { not: null }, api: { organisationId } },
      include: { api: { include: { repository: true } } },
      orderBy: { publishedAt: 'desc' },
      distinct: ['apiId'],
    });
    return versions.map((v) => ({
      apiId: v.apiId,
      name: v.api.name,
      repositoryUrl: v.api.repository.url,
      hostUrl: v.api.hostUrl,
      publishedAt: v.publishedAt,
      version: v.version,
    }));
  }

  async findOne(apiId: string, organisationId: string) {
    const api = await this.prisma.api.findFirst({
      where: { id: apiId, organisationId },
      include: {
        repository: true,
        endpoints: { include: { responses: true, auths: true } },
        schemas: true,
        versions: { where: { publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, take: 1 },
      },
    });

    if (!api) throw new NotFoundException(`API ${apiId} not found`);
    if (api.versions.length === 0) throw new NotFoundException(`API ${apiId} has no published version`);

    // Reconstruct an ApiGraph from Prisma rows so the generator can work
    const now = new Date();
    void now; // used implicitly via graph entity createdAt fields below
    const graph: ApiGraph = {
      repository: api.repository,
      api: { id: api.id, repositoryId: api.repositoryId, name: api.name, description: api.description ?? undefined, hostUrl: api.hostUrl ?? undefined, createdAt: api.createdAt, updatedAt: api.updatedAt },
      endpoints: api.endpoints.map((ep) => ({
        id: ep.id, apiId: ep.apiId, method: ep.method, path: ep.path,
        operationId: ep.operationId ?? undefined, summary: ep.summary ?? undefined,
        description: ep.description ?? undefined, tags: ep.tags,
        createdAt: ep.createdAt, updatedAt: ep.updatedAt,
      })),
      schemas: api.schemas.map((s) => ({ id: s.id, apiId: s.apiId, name: s.name, definition: s.definition as Record<string, unknown>, createdAt: s.createdAt, updatedAt: s.updatedAt })),
      auths: api.endpoints.flatMap((ep) =>
        ep.auths.map((a) => ({ id: a.id, endpointId: a.endpointId, type: a.type, scheme: a.scheme ?? undefined, scopes: a.scopes, verifiedByHuman: a.verifiedByHuman, createdAt: a.createdAt, updatedAt: a.updatedAt })),
      ),
      responses: api.endpoints.flatMap((ep) =>
        ep.responses.map((r) => ({ id: r.id, endpointId: r.endpointId, statusCode: r.statusCode, description: r.description ?? undefined, content: r.content as Record<string, { schema?: unknown }> | undefined, createdAt: r.createdAt, updatedAt: r.updatedAt })),
      ),
      versions: api.versions.map((v) => ({ id: v.id, apiId: v.apiId, extractionRunId: v.extractionRunId, version: v.version, publishedAt: v.publishedAt ?? undefined, createdAt: v.createdAt })),
    };

    const openApiDoc = generateOpenApi(graph);
    return { api: graph.api, endpoints: graph.endpoints, openApiDoc };
  }
}
