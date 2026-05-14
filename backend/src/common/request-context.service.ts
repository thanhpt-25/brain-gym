import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * RequestContextService stores request-scoped data (like org context) using AsyncLocalStorage.
 * This allows any part of the code to access request context without passing it explicitly.
 */
@Injectable()
export class RequestContextService {
  private static readonly asyncLocalStorage = new AsyncLocalStorage<{
    orgId?: string;
  }>();

  /**
   * Run a callback within a request context
   */
  static run<T>(context: { orgId?: string }, callback: () => T): T {
    return this.asyncLocalStorage.run(context, callback);
  }

  /**
   * Get the current request context
   */
  static getContext(): { orgId?: string } | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get the current org ID from context
   */
  static getOrgId(): string | undefined {
    return this.asyncLocalStorage.getStore()?.orgId;
  }
}
