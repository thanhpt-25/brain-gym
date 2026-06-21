import { Module } from '@nestjs/common';
import { IdpController } from './idp.controller';
import { IdpService } from './idp.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [OrganizationsModule],
  controllers: [IdpController],
  providers: [IdpService],
  exports: [IdpService],
})
export class IdpModule {}
