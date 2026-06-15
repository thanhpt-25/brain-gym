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
            get: () => Promise.resolve(null),
            set: () => Promise.resolve('OK'),
            setex: () => Promise.resolve('OK'),
            getdel: () => Promise.resolve(null),
            del: () => Promise.resolve(0),
            incr: () => Promise.resolve(1),
            expire: () => Promise.resolve(1),
            quit: () => Promise.resolve('OK'),
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
