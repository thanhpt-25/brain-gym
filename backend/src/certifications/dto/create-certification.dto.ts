import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateCertificationDto {
    @ApiProperty({ example: 'Solutions Architect Associate' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ example: 'uuid-of-provider' })
    @IsString()
    @IsNotEmpty()
    providerId: string;

    @ApiProperty({ example: 'SAA-C03' })
    @IsString()
    @IsNotEmpty()
    code: string;

    @ApiPropertyOptional({ example: 'Design distributed systems on AWS...' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: ['Design Resilient Architectures'] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    domains?: string[];
}
