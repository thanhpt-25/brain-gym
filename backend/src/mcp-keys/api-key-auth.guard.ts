import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { McpKeysService } from './mcp-keys.service';

const MCP_KEY_PREFIX = 'mcp_';
const MIN_KEY_LENGTH = 20;

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly mcpKeys: McpKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw: string | undefined = req.headers['x-api-key'];

    if (!raw) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    if (!raw.startsWith(MCP_KEY_PREFIX) || raw.length < MIN_KEY_LENGTH) {
      throw new UnauthorizedException('Invalid API key');
    }

    const key = await this.mcpKeys.findByRawKey(raw);

    if (!key) {
      throw new UnauthorizedException('Invalid API key');
    }

    req.user = key.user;
    req.mcpKeyId = key.id;
    this.mcpKeys.updateLastUsed(key.id);

    return true;
  }
}
