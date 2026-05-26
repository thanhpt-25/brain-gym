import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { UserPlan } from '@prisma/client';

export class UpdateUserPlanDto {
  @ApiProperty({ enum: UserPlan })
  @IsEnum(UserPlan)
  plan: UserPlan;
}
