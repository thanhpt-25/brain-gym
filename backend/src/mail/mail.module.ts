import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { DigestModule } from './digest/digest.module';

@Global()
@Module({
  imports: [DigestModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
