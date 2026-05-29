import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { StorageService } from '../common/storage/storage.service';
import { AvatarUploadInterceptor } from '../common/storage/avatar-upload.interceptor';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  providers: [UsersService, StorageService, AvatarUploadInterceptor],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
