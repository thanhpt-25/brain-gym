import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { EventsService } from './events.service';
import { IngestEventsDto } from './dto/ingest-events.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('attempt')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ingest a batch of attempt events (max 50)' })
  @ApiResponse({ status: 202, description: 'Batch accepted for processing' })
  @ApiResponse({ status: 400, description: 'Invalid batch or payload' })
  async ingestAttemptEvents(
    @Req() req: AuthenticatedRequest,
    @Body() body: IngestEventsDto,
  ): Promise<{ accepted: boolean }> {
    await this.eventsService.ingest(req.user.id, body.events);
    return { accepted: true };
  }
}
