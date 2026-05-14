import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RequestContextService } from './request-context.service';

/**
 * Row-Level Security (RLS) Interceptor
 *
 * Enforces organization-scoped data access by storing the org context in AsyncLocalStorage.
 * This context is then used by Prisma middleware to set the `app.org_id` PostgreSQL session variable.
 *
 * Requires:
 * - Request to have `orgMembership` attached (typically by OrgRoleGuard)
 * - RLS policies enabled on org-scoped tables (org_members, org_questions, etc.)
 *
 * The AsyncLocalStorage approach works with:
 * - Connection pooling
 * - Dependency injection (services receive the org context automatically)
 * - Nested async operations
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const orgMembership = request.orgMembership;

    if (!orgMembership) {
      // If no org context, proceed without RLS (e.g., auth endpoints)
      return next.handle();
    }

    // Wrap the request handler in AsyncLocalStorage context
    return new Observable((subscriber) => {
      RequestContextService.run({ orgId: orgMembership.orgId }, () => {
        next.handle().subscribe(subscriber);
      });
    });
  }
}
