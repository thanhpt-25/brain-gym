import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        if (process.env.NODE_ENV === 'test') {
          // Stub that satisfies the injection token without opening a socket.
          // Tests needing real Redis behaviour should override REDIS_CLIENT
          // in their own Test.createTestingModule().
          return {
            get: async () => null,
            set: async () => 'OK',
            setex: async () => 'OK',
            getdel: async () => null,
            del: async () => 0,
            incr: async () => 1,
            expire: async () => 1,
            quit: async () => 'OK',
          } as unknown as Redis;
        }
        return new Redis({
          host: config.get('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get('REDIS_PASSWORD') || undefined,
          lazyConnect: true,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
