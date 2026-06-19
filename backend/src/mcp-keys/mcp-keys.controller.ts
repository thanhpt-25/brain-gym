import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';
import { McpKeysService } from './mcp-keys.service';

class CreateMcpKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

@ApiTags('MCP API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mcp-keys')
export class McpKeysController {
  constructor(private readonly service: McpKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List active MCP API keys for the current user' })
  list(@Req() req: AuthenticatedRequest) {
    return this.service.listKeys(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Generate a new MCP API key (plaintext returned once)' })
  generate(@Req() req: AuthenticatedRequest, @Body() dto: CreateMcpKeyDto) {
    return this.service.generateKey(req.user.id, dto.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an MCP API key' })
  async revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.service.revokeKey(req.user.id, id);
  }
}
