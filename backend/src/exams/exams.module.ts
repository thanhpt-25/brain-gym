import { Module } from '@nestjs/common';
import { ExamsController } from './exams.controller';
import { ExamsService } from './exams.service';
import { ExamDayController } from './exam-day.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ExamsController, ExamDayController],
  providers: [ExamsService],
  exports: [ExamsService],
})
export class ExamsModule {}
