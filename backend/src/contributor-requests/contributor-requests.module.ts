import { Module } from '@nestjs/common';
import { ContributorRequestsService } from './contributor-requests.service';
import { ContributorRequestsController } from './contributor-requests.controller';
import { AdminContributorRequestsController } from './admin-contributor-requests.controller';

@Module({
  controllers: [
    ContributorRequestsController,
    AdminContributorRequestsController,
  ],
  providers: [ContributorRequestsService],
  exports: [ContributorRequestsService],
})
export class ContributorRequestsModule {}
