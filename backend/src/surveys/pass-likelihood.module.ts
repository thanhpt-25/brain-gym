import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PassLikelihoodController } from './pass-likelihood.controller';
import { PassLikelihoodService } from './pass-likelihood.service';

@Module({
  imports: [PrismaModule],
  controllers: [PassLikelihoodController],
  providers: [PassLikelihoodService],
  exports: [PassLikelihoodService],
})
export class PassLikelihoodModule {}
