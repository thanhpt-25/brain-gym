import { Module } from '@nestjs/common';
import { ExecutiveDashboardController } from './executive-dashboard.controller';
import { ExecutiveDashboardService } from './executive-dashboard.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [OrganizationsModule, RedisModule],
  controllers: [ExecutiveDashboardController],
  providers: [ExecutiveDashboardService],
})
export class ExecutiveDashboardModule {}
