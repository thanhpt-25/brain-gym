import { Module } from '@nestjs/common';
import { SseGateway } from './sse/sse.gateway';

@Module({
  providers: [SseGateway],
  exports: [SseGateway],
})
export class CommonModule {}
