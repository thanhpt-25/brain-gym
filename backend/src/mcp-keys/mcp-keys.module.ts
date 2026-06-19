import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { McpKeysService } from './mcp-keys.service';
import { McpKeysController } from './mcp-keys.controller';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [McpKeysController],
  providers: [McpKeysService, ApiKeyAuthGuard],
  exports: [McpKeysService, ApiKeyAuthGuard],
})
export class McpKeysModule {}
