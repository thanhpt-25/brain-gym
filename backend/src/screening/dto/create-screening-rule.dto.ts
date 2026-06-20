import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  Min,
  Max,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

function IsValidDomainScoresMap(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'IsValidDomainScoresMap',
      target: object.constructor,
      propertyName,
      options: {
        message:
          'Each value in minDomainScores must be a number between 0 and 100',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          if (value === null || value === undefined) return true;
          if (typeof value !== 'object' || Array.isArray(value)) return false;
          return Object.values(value as Record<string, unknown>).every(
            (v) => typeof v === 'number' && v >= 0 && v <= 100,
          );
        },
      },
    });
  };
}

export enum ScreeningAction {
  SHORTLIST = 'SHORTLIST',
  REJECT = 'REJECT',
}

export class CreateScreeningRuleDto {
  @IsEnum(ScreeningAction)
  action: ScreeningAction;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minIntegrity?: number;

  @IsOptional()
  @IsValidDomainScoresMap()
  minDomainScores?: Record<string, number>;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
