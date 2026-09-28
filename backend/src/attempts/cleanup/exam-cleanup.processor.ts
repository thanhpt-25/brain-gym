import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EXAM_CLEANUP_QUEUE } from './exam-cleanup.constants';
import { ExamCleanupReport, ExamCleanupService } from './exam-cleanup.service';

@Processor(EXAM_CLEANUP_QUEUE)
export class ExamCleanupProcessor extends WorkerHost {
  constructor(private readonly cleanup: ExamCleanupService) {
    super();
  }

  async process(_job: Job): Promise<ExamCleanupReport> {
    return this.cleanup.run();
  }
}
