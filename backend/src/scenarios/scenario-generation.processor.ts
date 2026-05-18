import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  SCENARIO_GENERATION_QUEUE,
  ScenarioGenerationJobData,
  ScenarioGenerationJobResult,
} from '../queues/scenario-generation/scenario-generation.job.interface';
import { ScenariosService } from './scenarios.service';

@Processor(SCENARIO_GENERATION_QUEUE)
export class ScenarioGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ScenarioGenerationProcessor.name);

  constructor(private scenariosService: ScenariosService) {
    super();
  }

  async process(
    job: Job<ScenarioGenerationJobData>,
  ): Promise<ScenarioGenerationJobResult> {
    this.logger.log(`Processing scenario job ${job.id}: ${job.data.topic}`);

    try {
      const result = await this.scenariosService.processScenarioJob(job.data);
      this.logger.log(`Completed scenario job ${job.id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed scenario job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  onActive(job: Job<ScenarioGenerationJobData>) {
    this.logger.debug(`Job ${job.id} started processing`);
  }

  onCompleted(
    job: Job<ScenarioGenerationJobData>,
    result: ScenarioGenerationJobResult,
  ) {
    this.logger.log(
      `Job ${job.id} completed. Cost: $${result.costUsd}, Questions: ${result.questions?.length || 0}`,
    );
  }

  onFailed(job: Job<ScenarioGenerationJobData>, err: Error) {
    this.logger.error(
      `Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`,
    );
  }
}
