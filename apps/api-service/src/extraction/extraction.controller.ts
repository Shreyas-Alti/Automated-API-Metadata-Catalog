import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ExtractionService, SubmitExtractionDto } from './extraction.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/extractions')
@UseGuards(JwtAuthGuard)
export class ExtractionController {
  constructor(private readonly service: ExtractionService) {}

  /** Submit a repository for extraction. */
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  submit(@Body() dto: SubmitExtractionDto, @Request() req: { user: { userId: string } }) {
    return this.service.submit(dto, req.user.userId);
  }

  /** Get the status of an extraction run. */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** List all extraction runs for the current user's organisation. */
  @Get()
  list(@Request() req: { user: { userId: string } }) {
    return this.service.list(req.user.userId);
  }
}
