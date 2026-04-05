import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { CandidateController } from './candidate.controller';
import { AssessmentsService } from './assessments.service';
import { CandidateService } from './candidate.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [OrganizationsModule],
  controllers: [AssessmentsController, CandidateController],
  providers: [AssessmentsService, CandidateService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
