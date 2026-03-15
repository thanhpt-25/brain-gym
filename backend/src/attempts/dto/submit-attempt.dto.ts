import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SubmitAnswerDto } from './submit-answer.dto';

export class SubmitAttemptDto {
    @ApiProperty({ type: [SubmitAnswerDto], description: 'All answers for the attempt' })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SubmitAnswerDto)
    answers: SubmitAnswerDto[];
}
