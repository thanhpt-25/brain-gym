import { Module } from '@nestjs/common';
import { MasteryController } from './mastery.controller';
import { MasteryService } from './mastery.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MasteryController],
  providers: [MasteryService],
  exports: [MasteryService],
})
export class MasteryModule {}
