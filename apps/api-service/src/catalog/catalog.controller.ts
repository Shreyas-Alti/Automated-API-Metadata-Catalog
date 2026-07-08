import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly service: CatalogService) {}

  /** List all published APIs. */
  @Get()
  list(@Request() req: { user: { organisationId: string } }) {
    return this.service.listPublished(req.user.organisationId);
  }

  /** Get a published API with its endpoints and OpenAPI document. */
  @Get(':apiId')
  findOne(@Param('apiId') apiId: string, @Request() req: { user: { organisationId: string } }) {
    return this.service.findOne(apiId, req.user.organisationId);
  }
}
