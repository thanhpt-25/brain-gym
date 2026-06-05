import { Module } from '@nestjs/common';
import { JobRolesController } from './job-roles.controller';
import { JobRolesService } from './job-roles.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [OrganizationsModule],
  controllers: [JobRolesController],
  providers: [JobRolesService],
  exports: [JobRolesService],
})
export class JobRolesModule {}
