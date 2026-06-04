import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const makeReflector = (isPublic: boolean): Reflector =>
    ({ getAllAndOverride: () => isPublic }) as any;

  const makeContext = (headers: Record<string, any>): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as any;

  describe('public routes', () => {
    it('allows anonymous access when no token is provided', () => {
      const guard = new JwtAuthGuard(makeReflector(true));
      const ctx = makeContext({});

      expect(guard.handleRequest(null, false, undefined, ctx)).toBeNull();
    });

    it('attaches the user when a valid token is provided', () => {
      const guard = new JwtAuthGuard(makeReflector(true));
      const ctx = makeContext({ authorization: 'Bearer valid.token' });
      const user = { id: 'u1' };

      expect(guard.handleRequest(null, user, undefined, ctx)).toBe(user);
    });

    it('rejects with 401 when a token is provided but expired/invalid', () => {
      // Regression: an authenticated user whose access token expired must NOT
      // be silently downgraded to anonymous on public routes. Returning a 401
      // lets the client refresh the token and retry instead of getting
      // anonymous content (e.g. the "Log in to view the explanation" placeholder).
      const guard = new JwtAuthGuard(makeReflector(true));
      const ctx = makeContext({ authorization: 'Bearer expired.token' });
      const info = new Error('jwt expired');

      expect(() => guard.handleRequest(null, false, info, ctx)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('protected routes', () => {
    it('rejects when no user is resolved', () => {
      const guard = new JwtAuthGuard(makeReflector(false));
      const ctx = makeContext({});

      expect(() => guard.handleRequest(null, false, undefined, ctx)).toThrow(
        UnauthorizedException,
      );
    });

    it('returns the user when authenticated', () => {
      const guard = new JwtAuthGuard(makeReflector(false));
      const ctx = makeContext({ authorization: 'Bearer valid.token' });
      const user = { id: 'u1' };

      expect(guard.handleRequest(null, user, undefined, ctx)).toBe(user);
    });
  });
});
