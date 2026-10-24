import { Module, forwardRef } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller';
import { CandidateController } from './candidate.controller';
import { AssessmentsService } from './assessments.service';
import { CandidateService } from './candidate.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MailModule } from '../mail/mail.module';
import { ScreeningModule } from '../screening/screening.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';

@Module({
  imports: [
    OrganizationsModule,
    MailModule,
    forwardRef(() => ScreeningModule),
    EmailTemplatesModule,
  ],
  controllers: [AssessmentsController, CandidateController],
  providers: [AssessmentsService, CandidateService],
  exports: [AssessmentsService],
})
export class AssessmentsModule {}
