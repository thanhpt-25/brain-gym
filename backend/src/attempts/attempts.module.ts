import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';

@Module({
    controllers: [AttemptsController],
    providers: [AttemptsService],
    exports: [AttemptsService],
})
export class AttemptsModule { }
