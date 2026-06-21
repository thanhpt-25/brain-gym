import { Module } from '@nestjs/common';
import { CompetencyCertController } from './competency-cert.controller';
import { CompetencyCertService } from './competency-cert.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ScorecardModule } from '../scorecard/scorecard.module';

@Module({
  imports: [OrganizationsModule, ScorecardModule],
  controllers: [CompetencyCertController],
  providers: [CompetencyCertService],
  exports: [CompetencyCertService],
})
export class CompetencyCertModule {}
