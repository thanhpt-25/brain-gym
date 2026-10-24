// Global Jest setup for e2e tests
// Sets environment variables needed by NestJS modules

import { jest } from '@jest/globals';

process.env.LLM_KEY_ENCRYPTION_SECRET =
  process.env.LLM_KEY_ENCRYPTION_SECRET ||
  'testsecret_must_be_32_chars_long_exactly';

// @nestjs/throttler@6.7.1 and @bull-board/nestjs@7.0.0 both ship precompiled
// CommonJS that does a top-level `require('@nestjs/common')` -- and
// @nestjs/common is ESM-only since NestJS 12. Jest's own module loader
// (its CJS->ESM interop + the global compile hook it installs for every
// .js file) unconditionally refuses that, with no config flag to disable
// it -- confirmed empirically: even bypassing it via Node's own
// `createRequire` doesn't help, because Jest's compile hook still runs for
// any file loaded off disk, regardless of which `require` function
// initiated the load. Neither package's rate-limiting / dashboard behavior
// is exercised by any e2e assertion (grepped for 429/ThrottlerException
// across test/**/*.e2e-spec.ts -- the one real 429 is an unrelated business
// rule), so registering lightweight ESM mocks here -- before any e2e spec's
// own `import { AppModule } from '../src/app.module'` resolves, since
// setupFiles run first -- is the safe, minimal fix. AppModule's imports
// array calls `ThrottlerModule.forRoot(...)`/`BullBoardModule.forRoot(...)`/
// `.forFeature(...)`, and several controllers use the `@Throttle()` /
// `@SkipThrottle()` decorators -- this mock covers exactly that surface.
jest.unstable_mockModule('@nestjs/throttler', () => {
  class ThrottlerGuard {
    canActivate() {
      return true;
    }
  }
  class ThrottlerModule {
    static forRoot() {
      return { module: ThrottlerModule };
    }
  }
  // Matches the real decorator's (target, propertyKey, descriptor) =>
  // descriptor ?? target contract -- a method decorator (stacked with e.g.
  // @Get()) must return the PropertyDescriptor it was given, not the class.
  const passthroughDecorator =
    () =>
    (
      target: unknown,
      _propertyKey?: string | symbol,
      descriptor?: PropertyDescriptor,
    ) =>
      descriptor ?? target;
  const Throttle = passthroughDecorator;
  const SkipThrottle = passthroughDecorator;
  return { ThrottlerModule, ThrottlerGuard, Throttle, SkipThrottle };
});

jest.unstable_mockModule('@bull-board/nestjs', () => {
  class BullBoardModule {
    static forRoot() {
      return { module: BullBoardModule };
    }
    static forFeature() {
      return { module: BullBoardModule };
    }
  }
  return { BullBoardModule };
});
