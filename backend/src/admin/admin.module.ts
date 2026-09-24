import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ContributorRequestsModule } from '../contributor-requests/contributor-requests.module';

@Module({
  imports: [ContributorRequestsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
