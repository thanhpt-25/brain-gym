import { PartialType } from '@nestjs/swagger';
import { CreateOrgQuestionDto } from './create-org-question.dto';

export class UpdateOrgQuestionDto extends PartialType(CreateOrgQuestionDto) {}
