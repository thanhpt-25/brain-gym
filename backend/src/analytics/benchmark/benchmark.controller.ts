import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BenchmarkService } from './benchmark.service';

@Controller('analytics/benchmark')
@UseGuards(AuthGuard('jwt'))
export class BenchmarkController {
  constructor(private readonly benchmark: BenchmarkService) {}

  /**
   * GET /analytics/benchmark?certificationId=<id>
   * Returns the caller's percentile rank vs cohort for one certification.
   * Cohort stats are hidden when n < 10 (k-anonymity Gate 3).
   */
  @Get()
  async getBenchmark(
    @CurrentUser('id') userId: string,
    @Query('certificationId') certificationId: string,
  ) {
    return this.benchmark.getBenchmark(userId, certificationId);
  }

  /**
   * GET /analytics/benchmark/all
   * Returns benchmarks for every certification the caller has a score in.
   */
  @Get('all')
  async getAllBenchmarks(@CurrentUser('id') userId: string) {
    return this.benchmark.getAllBenchmarks(userId);
  }
}
