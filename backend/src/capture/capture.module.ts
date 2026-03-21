import { Module } from '@nestjs/common';
import { CaptureService } from './capture.service';
import { CaptureController } from './capture.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [CaptureService],
  controllers: [CaptureController],
  exports: [CaptureService],
})
export class CaptureModule {}
