import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsArray, Min, IsUUID } from 'class-validator';
import { ExamVisibility } from '@prisma/client';

export class CreateExamDto {
    @ApiProperty({ example: 'AWS SAA Mock Test #1' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ example: 'Practice exam for AWS Solutions Architect Associate' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: 'aws-saa' })
    @IsString()
    @IsNotEmpty()
    certificationId: string;

    @ApiProperty({ example: 65 })
    @IsInt()
    @Min(1)
    questionCount: number;

    @ApiProperty({ example: 130, description: 'Time limit in minutes' })
    @IsInt()
    @Min(1)
    timeLimit: number;

    @ApiPropertyOptional({ enum: ExamVisibility, example: ExamVisibility.PUBLIC })
    @IsEnum(ExamVisibility)
    @IsOptional()
    visibility?: ExamVisibility;

    @ApiPropertyOptional({ description: 'Specific question IDs to include. If empty, questions are randomly selected.' })
    @IsArray()
    @IsUUID('4', { each: true })
    @IsOptional()
    questionIds?: string[];
}
