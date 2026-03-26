import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, ValidateNested, IsArray } from 'class-validator';
import { QuestionType, Difficulty } from '@prisma/client';

export class CreateChoiceDto {
    @ApiProperty({ example: 'a' })
    @IsString()
    @IsNotEmpty()
    label: string;

    @ApiProperty({ example: 'Amazon S3' })
    @IsString()
    @IsNotEmpty()
    content: string;

    @ApiPropertyOptional({ example: false })
    @IsBoolean()
    @IsOptional()
    isCorrect?: boolean;
}

export class CreateQuestionDto {
    @ApiProperty({ example: 'Which AWS service provides a managed relational database?' })
    @IsString()
    @IsNotEmpty()
    title: string;

    @ApiPropertyOptional({ example: 'The company has regulatory requirements...' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ enum: QuestionType, example: QuestionType.SINGLE })
    @IsEnum(QuestionType)
    @IsOptional()
    questionType?: QuestionType;

    @ApiPropertyOptional({ enum: Difficulty, example: Difficulty.MEDIUM })
    @IsEnum(Difficulty)
    @IsOptional()
    difficulty?: Difficulty;

    @ApiPropertyOptional({ example: 'Amazon RDS is a managed service that makes it easy to set up...' })
    @IsString()
    @IsOptional()
    explanation?: string;

    @ApiProperty({ example: 'aws-saa' })
    @IsString()
    @IsNotEmpty()
    certificationId: string;

    @ApiPropertyOptional({ example: 'domain-id-here' })
    @IsString()
    @IsOptional()
    domainId?: string;

    @ApiPropertyOptional({ example: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html' })
    @IsString()
    @IsOptional()
    referenceUrl?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    codeSnippet?: string;

    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    imageUrl?: string;

    @ApiPropertyOptional({ example: false })
    @IsBoolean()
    @IsOptional()
    isScenario?: boolean;

    @ApiPropertyOptional({ example: false, description: 'Mark as a trap/tricky question for the Trap Question Library' })
    @IsBoolean()
    @IsOptional()
    isTrapQuestion?: boolean;

    @ApiProperty({ type: [CreateChoiceDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateChoiceDto)
    choices: CreateChoiceDto[];

    @ApiPropertyOptional({ type: [String], example: ['aws', 'storage'] })
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    tags?: string[];
}
