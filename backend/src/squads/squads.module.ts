import { Module } from '@nestjs/common';
import { SquadsController } from './squads.controller';
import { SquadsService } from './squads.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SquadsController],
  providers: [SquadsService],
})
export class SquadsModule {}
