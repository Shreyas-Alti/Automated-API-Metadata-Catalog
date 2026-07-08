import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewService, EditEndpointDto } from './review.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/reviews')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly service: ReviewService) {}

  /** List extraction runs that are pending human review. */
  @Get()
  list(@Request() req: { user: { organisationId: string } }) {
    return this.service.listPendingReviews(req.user.organisationId);
  }

  /** Get the full draft for a review (endpoints + evidence + scores). */
  @Get(':runId')
  findOne(@Param('runId') runId: string, @Request() req: { user: { organisationId: string } }) {
    return this.service.getReview(runId, req.user.organisationId);
  }

  /** Edit a single endpoint's field. Recorded in the audit log. */
  @Patch(':runId/endpoints/:endpointId')
  editEndpoint(
    @Param('runId') runId: string,
    @Param('endpointId') endpointId: string,
    @Body() dto: EditEndpointDto,
    @Request() req: { user: { userId: string; organisationId: string } },
  ) {
    return this.service.editEndpoint(runId, endpointId, dto, req.user.userId, req.user.organisationId);
  }

  /** Publish a reviewed extraction — transitions run to 'published'. */
  @Post(':runId/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('runId') runId: string, @Request() req: { user: { userId: string; organisationId: string } }) {
    return this.service.publish(runId, req.user.userId, req.user.organisationId);
  }
}
