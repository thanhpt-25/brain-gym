import { Module } from '@nestjs/common';
import { ApplyService } from './apply.service';
import { ApplyPublicController } from './apply-public.controller';
import { ApplyAdminController } from './apply-admin.controller';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [OrganizationsModule],
  controllers: [ApplyPublicController, ApplyAdminController],
  providers: [ApplyService],
  exports: [ApplyService],
})
export class ApplyModule {}
