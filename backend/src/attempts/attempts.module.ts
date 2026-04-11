import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { GamificationModule } from '../gamification/gamification.module';
import { ExamsModule } from '../exams/exams.module';

@Module({
  imports: [GamificationModule, ExamsModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
