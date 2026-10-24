import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { EmailTemplateTrigger } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../organizations/guards/org-role.guard';
import { OrgRoles } from '../common/decorators/org-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EmailTemplatesService } from './email-templates.service';
import {
  PreviewEmailTemplateDto,
  UpsertEmailTemplateDto,
} from './dto/upsert-email-template.dto';

@Controller('organizations/:orgId/email-templates')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
@OrgRoles('OWNER', 'ADMIN')
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Get()
  list(@Param('orgId') orgId: string) {
    return this.service.list(orgId);
  }

  @Put(':trigger')
  upsert(
    @Param('orgId') orgId: string,
    @Param('trigger') trigger: EmailTemplateTrigger,
    @Body() dto: UpsertEmailTemplateDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.service.upsert(orgId, trigger, dto, userId);
  }

  @Delete(':trigger')
  remove(
    @Param('orgId') orgId: string,
    @Param('trigger') trigger: EmailTemplateTrigger,
  ) {
    return this.service.remove(orgId, trigger);
  }

  @Post('preview')
  preview(@Body() dto: PreviewEmailTemplateDto) {
    return this.service.preview(dto.subject, dto.bodyHtml);
  }
}
