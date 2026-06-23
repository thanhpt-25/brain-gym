import { Module } from '@nestjs/common';
import { PrivacyService } from './privacy.service';

@Module({
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
