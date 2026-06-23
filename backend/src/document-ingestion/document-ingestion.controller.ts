import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DocumentIngestionService } from './document-ingestion.service';
import { CreateIngestionJobDto } from './dto/create-ingestion-job.dto';

@Controller('admin/ingestion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DocumentIngestionController {
  constructor(private readonly service: DocumentIngestionService) {}

  @Post('estimate')
  @UseInterceptors(FileInterceptor('file'))
  async estimate(
    @UploadedFile() file: Express.Multer.File,
    @Body('certificationId') certificationId: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.service.estimate(file.buffer, certificationId);
  }

  @Post('jobs')
  @UseInterceptors(FileInterceptor('file'))
  async createJob(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateIngestionJobDto,
    @CurrentUser('id') userId: string,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.service.createJob(file.buffer, file.originalname, dto, userId);
  }

  @Get('jobs')
  listJobs(
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listJobs(
      userId,
      Math.max(1, Number(page) || 1),
      Math.min(Number(limit) || 20, 100),
    );
  }

  @Get('jobs/:jobId')
  getJob(@Param('jobId') jobId: string, @CurrentUser('id') userId: string) {
    return this.service.getJob(jobId, userId);
  }
}
