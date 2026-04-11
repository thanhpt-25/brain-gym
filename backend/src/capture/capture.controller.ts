import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  Req,
  Param,
} from '@nestjs/common';
import { CaptureService } from './capture.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCaptureDto } from './dto/create-capture.dto';

@Controller('capture')
@UseGuards(JwtAuthGuard)
export class CaptureController {
  constructor(private readonly captureService: CaptureService) {}

  @Post()
  async capture(@Req() req: any, @Body() dto: CreateCaptureDto) {
    return this.captureService.captureWord(req.user.id, dto);
  }

  @Get()
  async getPending(@Req() req: any) {
    return this.captureService.getPendingCaptures(req.user.id);
  }

  @Put(':id/status')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body('status') status: 'processed' | 'discarded',
  ) {
    return this.captureService.updateStatus(req.user.id, id, status);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.captureService.deleteCapture(req.user.id, id);
  }
}
