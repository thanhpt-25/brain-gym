import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { McpKeysService } from './mcp-keys.service';

const mockMcpKeysService = {
  findByHash: jest.fn(),
  updateLastUsed: jest.fn(),
};

function makeContext(headers: Record<string, string> = {}) {
  const req: any = { headers, mcpKeyId: undefined, user: undefined };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyAuthGuard', () => {
  let guard: ApiKeyAuthGuard;

  beforeEach(() => {
    guard = new ApiKeyAuthGuard(mockMcpKeysService as unknown as McpKeysService);
    jest.clearAllMocks();
  });

  it('should throw UnauthorizedException when X-API-Key header is missing', async () => {
    await expect(guard.canActivate(makeContext())).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException for malformed key (no mcp_ prefix)', async () => {
    await expect(
      guard.canActivate(makeContext({ 'x-api-key': 'badkey' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when key hash not found in DB', async () => {
    mockMcpKeysService.findByHash.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ 'x-api-key': 'mcp_validlooking12345678901234567890123456' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should set req.user and req.mcpKeyId and return true for valid key', async () => {
    const fakeKey = {
      id: 'key-1',
      userId: 'user-1',
      user: { id: 'user-1', email: 'x@x.com', role: 'CONTRIBUTOR', displayName: 'X' },
    };
    mockMcpKeysService.findByHash.mockResolvedValue(fakeKey);

    const ctx = makeContext({ 'x-api-key': 'mcp_validlooking12345678901234567890123456' });
    const req = ctx.switchToHttp().getRequest();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(req.user).toEqual({ id: 'user-1', email: 'x@x.com', role: 'CONTRIBUTOR', displayName: 'X' });
    expect(req.mcpKeyId).toBe('key-1');
    expect(mockMcpKeysService.updateLastUsed).toHaveBeenCalledWith('key-1');
  });
});
