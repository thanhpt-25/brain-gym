import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';
import {
  PassLikelihoodStatusDto,
  SubmitPassLikelihoodDto,
} from './dto/submit-pass-likelihood.dto';
import { PassLikelihoodService } from './pass-likelihood.service';

@ApiTags('surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('surveys/pass-likelihood')
export class PassLikelihoodController {
  constructor(private readonly service: PassLikelihoodService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Submit a pass-likelihood self-report (1–10) for the predictor validation cohort',
  })
  async submit(
    @Req() req: AuthenticatedRequest,
    @Body() body: SubmitPassLikelihoodDto,
  ) {
    return this.service.submit(req.user.id, body.certificationId, body.score);
  }

  @Get()
  @ApiOperation({
    summary:
      'Check whether the current user has already responded for a certification',
  })
  @ApiQuery({ name: 'certificationId', type: 'string' })
  async status(
    @Req() req: AuthenticatedRequest,
    @Query('certificationId') certificationId: string,
  ): Promise<PassLikelihoodStatusDto> {
    return this.service.getStatus(req.user.id, certificationId);
  }
}
