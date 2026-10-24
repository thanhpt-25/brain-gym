import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrivacyService } from './privacy.service';

@Controller('admin/privacy')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Post('run-retention')
  @HttpCode(200)
  runRetention() {
    return this.service.runRetentionJob();
  }
}
