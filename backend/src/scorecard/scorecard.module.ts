import { Module } from '@nestjs/common';
import { ScorecardController } from './scorecard.controller';
import { ScorecardService } from './scorecard.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [OrganizationsModule],
  controllers: [ScorecardController],
  providers: [ScorecardService],
  exports: [ScorecardService],
})
export class ScorecardModule {}
