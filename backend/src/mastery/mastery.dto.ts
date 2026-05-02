import { ApiProperty } from '@nestjs/swagger';

export class DomainMasteryDto {
  @ApiProperty({ description: 'Domain unique identifier' })
  domainId: string;

  @ApiProperty({ description: 'Domain display name' })
  domainName: string;

  @ApiProperty({ description: 'Accuracy as a 0-100 integer' })
  accuracy: number;

  @ApiProperty({ description: 'Total questions answered in this domain' })
  totalAnswered: number;

  @ApiProperty({ description: 'Total correct answers in this domain' })
  totalCorrect: number;

  @ApiProperty({
    description:
      'Fraction of domain questions covered by an active SRS schedule (0-1)',
  })
  srsCoverage: number;

  @ApiProperty({
    description: 'Count of SRS cards due for review today or overdue',
  })
  dueCount: number;
}

export class MasteryResponseDto {
  @ApiProperty({ description: 'Certification ID the data is scoped to' })
  certificationId: string;

  @ApiProperty({
    description: 'Total exam attempts included in the aggregation',
  })
  totalAttempts: number;

  @ApiProperty({
    description:
      'Whether the user has enough attempts to show meaningful data (< 10 returns isEmpty: true)',
  })
  isEmpty: boolean;

  @ApiProperty({ type: [DomainMasteryDto] })
  domains: DomainMasteryDto[];
}
