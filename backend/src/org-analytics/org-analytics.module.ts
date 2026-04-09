import { Module } from '@nestjs/common';
import { OrgAnalyticsController } from './org-analytics.controller';
import { OrgAnalyticsService } from './org-analytics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrgAnalyticsController],
  providers: [OrgAnalyticsService],
  exports: [OrgAnalyticsService],
})
export class OrgAnalyticsModule {}
