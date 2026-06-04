import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      // Still try to extract user from token, but don't fail if missing
      return super.canActivate(context);
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      if (user) {
        return user;
      }

      // No credentials supplied at all → genuine anonymous visitor, allow through.
      const request = context.switchToHttp().getRequest();
      if (!request?.headers?.authorization) {
        return null;
      }

      // A token WAS supplied but failed validation (expired / invalid). Do NOT
      // silently downgrade an authenticated user to anonymous — surface a 401 so
      // the client can refresh its token and retry. Otherwise authenticated
      // users with an expired access token keep receiving anonymous-only content
      // (e.g. the "Log in to view the explanation" placeholder).
      throw err || new UnauthorizedException('Invalid or expired token');
    }

    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or missing token');
    }
    return user;
  }
}
