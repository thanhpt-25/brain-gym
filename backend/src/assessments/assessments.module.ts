import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { CandidateController } from './candidate.controller';
import { AssessmentsService } from './assessments.service';
import { CandidateService } from './candidate.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [OrganizationsModule, MailModule],
  controllers: [AssessmentsController, CandidateController],
  providers: [AssessmentsService, CandidateService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
