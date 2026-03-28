import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LlmProvider } from '@prisma/client';

export class ConfigureLlmDto {
    @ApiProperty({ enum: LlmProvider })
    @IsEnum(LlmProvider)
    provider: LlmProvider;

    @ApiProperty({ example: 'sk-...' })
    @IsString()
    @IsNotEmpty()
    apiKey: string;

    @ApiPropertyOptional({ example: 'gpt-4o' })
    @IsString()
    @IsOptional()
    modelId?: string;
}
