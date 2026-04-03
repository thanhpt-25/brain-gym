import { Module } from '@nestjs/common';
import { OrgQuestionsService } from './org-questions.service';
import { OrgQuestionsController } from './org-questions.controller';

@Module({
  controllers: [OrgQuestionsController],
  providers: [OrgQuestionsService],
  exports: [OrgQuestionsService],
})
export class OrgQuestionsModule {}
