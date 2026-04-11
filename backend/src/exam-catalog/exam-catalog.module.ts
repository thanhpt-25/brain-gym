import { Module } from '@nestjs/common';
import {
  ExamCatalogController,
  ExamTracksController,
} from './exam-catalog.controller';
import { ExamCatalogService } from './exam-catalog.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [OrganizationsModule],
  controllers: [ExamCatalogController, ExamTracksController],
  providers: [ExamCatalogService],
  exports: [ExamCatalogService],
})
export class ExamCatalogModule {}
