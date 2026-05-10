import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min } from 'class-validator';

export class SubmitPassLikelihoodDto {
  @ApiProperty({
    description: 'Certification the survey response is scoped to',
  })
  @IsString()
  certificationId!: string;

  @ApiProperty({
    description: 'Self-reported pass likelihood, 1 (low) – 10 (high)',
  })
  @IsInt()
  @Min(1)
  @Max(10)
  score!: number;
}

export class PassLikelihoodStatusDto {
  @ApiProperty({
    description:
      'Whether the user has already submitted a response for this cert',
  })
  submitted!: boolean;

  @ApiProperty({
    description: 'Previously submitted score, if any',
    required: false,
    nullable: true,
  })
  score?: number | null;
}
