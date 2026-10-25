import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma-client';
import { RequestContextService } from '../common/request-context.service';

/**
 * PrismaService with RLS (Row-Level Security) support.
 *
 * When RequestContextService has an org context set (via RlsInterceptor),
 * all queries are executed within a transaction that sets the PostgreSQL
 * app.org_id session variable. This variable is used by RLS policies
 * to enforce organization-scoped data access.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prisma 7 requires every PrismaClient to be constructed with an
    // explicit driver adapter; `new PrismaClient()` with no arguments is
    // no longer supported. Unlike the old query engine, @prisma/adapter-pg
    // does not auto-negotiate TLS, and RDS requires it — so every query
    // was failing in production (see incident: every DB-touching endpoint
    // returning 500 right after the Prisma 7 migration). Local/docker-compose
    // Postgres has no TLS configured, so this only enables it outside dev.
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : undefined,
      }),
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Extend the Prisma client with RLS context support
    // Note: We can't override the parent constructor's $extends,
    // so we monkey-patch the critical query methods instead
    this.patchWithRlsContext();
  }

  private patchWithRlsContext() {
    // Get the original query methods
    const originalOrgMember = this.orgMember;
    const originalOrgQuestion = this.orgQuestion;

    // Create RLS-aware proxies for org-scoped models
    const createRlsProxy = (model: any, modelName: string) => {
      return new Proxy(model, {
        get: (target, prop) => {
          const method = target[prop];

          if (typeof method === 'function') {
            return (...args: any[]) => {
              const orgId = RequestContextService.getOrgId();

              if (orgId && this.isQueryMethod(prop as string)) {
                // Wrap in a transaction with RLS context
                return this.$transaction(
                  async (tx) => {
                    await (tx as any).$executeRawUnsafe(
                      `SET LOCAL app.org_id = '${orgId}'`,
                    );
                    return (tx as any)[modelName][prop](...args);
                  },
                  { isolationLevel: 'ReadCommitted' },
                );
              }

              // No org context, call normally
              return method.apply(target, args);
            };
          }

          return method;
        },
      });
    };

    // Apply RLS proxies to org-scoped models
    (this as any).orgMember = createRlsProxy(originalOrgMember, 'orgMember');
    (this as any).orgQuestion = createRlsProxy(
      originalOrgQuestion,
      'orgQuestion',
    );
  }

  private isQueryMethod(methodName: string): boolean {
    return [
      'create',
      'findFirst',
      'findUnique',
      'findMany',
      'update',
      'upsert',
      'delete',
      'deleteMany',
      'count',
      'aggregate',
      'groupBy',
    ].includes(methodName);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
