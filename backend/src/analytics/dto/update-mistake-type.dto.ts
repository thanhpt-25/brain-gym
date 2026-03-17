import { IsEnum } from 'class-validator';
import { MistakeType } from '@prisma/client';

export class UpdateMistakeTypeDto {
  @IsEnum(MistakeType)
  mistakeType: MistakeType;
}
