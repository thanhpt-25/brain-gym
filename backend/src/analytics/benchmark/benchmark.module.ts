import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BenchmarkService } from './benchmark.service';
import { BenchmarkController } from './benchmark.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BenchmarkController],
  providers: [BenchmarkService],
  exports: [BenchmarkService],
})
export class BenchmarkModule {}
