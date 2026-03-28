import {
    Body, Controller, Delete, Get, Param, Post, Query,
    Req, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
    ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/interfaces/request.interface';
import { AiQuestionBankService } from './ai-question-bank.service';
import { IngestionService } from './ingestion/ingestion.service';
import { ConfigureLlmDto } from './dto/configure-llm.dto';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { SaveGeneratedQuestionsDto } from './dto/save-questions.dto';
import { UploadMaterialDto } from './dto/upload-material.dto';
import { McpIntakeDto } from './mcp/mcp-intake.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('AI Question Bank')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-questions')
export class AiQuestionBankController {
    constructor(
        private readonly service: AiQuestionBankService,
        private readonly ingestion: IngestionService,
    ) {}

    // ─── LLM Config ─────────────────────────────────────────────────────────────

    @Get('config')
    @ApiOperation({ summary: 'List configured LLM providers (keys masked)' })
    getLlmConfigs(@Req() req: AuthenticatedRequest) {
        return this.service.getLlmConfigs(req.user.id);
    }

    @Post('config')
    @ApiOperation({ summary: 'Save or update an LLM provider API key' })
    saveLlmConfig(@Req() req: AuthenticatedRequest, @Body() dto: ConfigureLlmDto) {
        return this.service.saveLlmConfig(req.user.id, dto);
    }

    @Delete('config/:provider')
    @ApiOperation({ summary: 'Remove an LLM provider config' })
    deleteLlmConfig(@Req() req: AuthenticatedRequest, @Param('provider') provider: string) {
        return this.service.deleteLlmConfig(req.user.id, provider as any);
    }

    @Post('config/:provider/validate')
    @ApiOperation({ summary: 'Test if an API key is valid' })
    validateLlmConfig(@Req() req: AuthenticatedRequest, @Param('provider') provider: string) {
        return this.service.validateLlmConfig(req.user.id, provider as any);
    }

    // ─── Material Ingestion ──────────────────────────────────────────────────────

    @Get('materials')
    @ApiOperation({ summary: 'List uploaded study materials' })
    getMaterials(@Req() req: AuthenticatedRequest, @Query('certificationId') certificationId?: string) {
        return this.ingestion.getMaterials(req.user.id, certificationId);
    }

    @Post('materials')
    @ApiOperation({ summary: 'Upload a study material (text or URL). For PDF use /materials/pdf' })
    uploadTextMaterial(@Req() req: AuthenticatedRequest, @Body() dto: UploadMaterialDto) {
        return this.ingestion.uploadMaterial(req.user.id, dto);
    }

    @Post('materials/pdf')
    @ApiOperation({ summary: 'Upload a PDF study material' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('file'))
    uploadPdfMaterial(
        @Req() req: AuthenticatedRequest,
        @Body() dto: UploadMaterialDto,
        @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
    ) {
        return this.ingestion.uploadMaterial(req.user.id, dto, file?.buffer);
    }

    @Get('materials/:id')
    @ApiOperation({ summary: 'Get material details' })
    getMaterial(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.ingestion.getMaterial(req.user.id, id);
    }

    @Delete('materials/:id')
    @ApiOperation({ summary: 'Delete a study material' })
    deleteMaterial(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        return this.ingestion.deleteMaterial(req.user.id, id);
    }

    // ─── Generation ──────────────────────────────────────────────────────────────

    @Post('estimate')
    @ApiOperation({ summary: 'Estimate token usage for a generation request' })
    estimateTokens(@Req() req: AuthenticatedRequest, @Body() dto: GenerateQuestionsDto) {
        return this.service.estimateTokens(req.user.id, dto);
    }

    @Post('generate')
    @Throttle({ default: { ttl: 3600000, limit: 10 } })
    @ApiOperation({ summary: 'Generate questions from source material (returns preview, not saved)' })
    generateQuestions(@Req() req: AuthenticatedRequest, @Body() dto: GenerateQuestionsDto) {
        return this.service.generateQuestions(req.user.id, dto);
    }

    @Post('save')
    @ApiOperation({ summary: 'Save selected generated questions to the question bank' })
    saveGeneratedQuestions(@Req() req: AuthenticatedRequest, @Body() dto: SaveGeneratedQuestionsDto) {
        return this.service.saveGeneratedQuestions(req.user.id, dto);
    }

    @Get('history')
    @ApiOperation({ summary: 'Paginated generation job history' })
    getHistory(
        @Req() req: AuthenticatedRequest,
        @Query('page') page = 1,
        @Query('limit') limit = 10,
    ) {
        return this.service.getHistory(req.user.id, +page, +limit);
    }

    // ─── MCP Intake ──────────────────────────────────────────────────────────────

    @Post('mcp/intake')
    @ApiOperation({ summary: 'MCP mode: receive questions pushed from external AI tools (Claude Desktop, etc.)' })
    mcpIntake(@Req() req: AuthenticatedRequest, @Body() dto: McpIntakeDto) {
        return this.service.mcpIntake(req.user.id, dto);
    }
}
