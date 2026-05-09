import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Row-Level Security (RLS) Interceptor
 *
 * Enforces organization-scoped data access by setting the `app.org_id` session variable
 * before each request. This variable is used by Postgres RLS policies to filter rows.
 *
 * Requires:
 * - Request to have `orgMembership` attached (typically by OrgRoleGuard)
 * - RLS policies enabled on org-scoped tables (org_members, org_questions, etc.)
 *
 * Safe with connection pooling because it uses `SET LOCAL` (per-transaction, not per-session).
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const orgMembership = request.orgMembership;

    if (!orgMembership) {
      // If no org context, proceed without RLS (e.g., auth endpoints)
      return next.handle();
    }

    // Execute the request within an RLS-aware transaction
    return new Promise((resolve, reject) => {
      this.prisma
        .$transaction(
          async (tx) => {
            // Set the org context for this transaction
            // This must be done on the raw client, not through Prisma client methods
            // Note: PostgreSQL SET commands don't support parameterized values,
            // so we use string interpolation here. The orgId is a UUID from the database,
            // so it's safe to interpolate directly (no risk of SQL injection).
            await tx.$executeRawUnsafe(
              `SET LOCAL app.org_id = '${orgMembership.orgId}'`,
            );

            // Replace the prisma client with the transactional one for downstream handlers
            const originalPrisma = request.prisma;
            request.prisma = tx;

            try {
              const result = await next.handle().toPromise();
              return result;
            } finally {
              // Restore original prisma client
              request.prisma = originalPrisma;
            }
          },
          {
            isolationLevel: 'ReadCommitted',
          },
        )
        .then(resolve)
        .catch(reject);
    });
  }
}
