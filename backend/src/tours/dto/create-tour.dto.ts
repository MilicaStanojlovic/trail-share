import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

/**
 * Accepts only a YYYY-MM-DD string that names a date the calendar actually has,
 * so 2030-02-31 is rejected here rather than by the database.
 */
export function IsRealCalendarDate(
  validationOptions?: ValidationOptions,
): (object: object, propertyName: string) => void {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isRealCalendarDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return false;
          }
          const parsed = new Date(`${value}T00:00:00Z`);
          if (Number.isNaN(parsed.getTime())) {
            return false;
          }
          // Round-trip: Date rolls 2030-02-31 forward to 2030-03-03, so a
          // mismatch means the input named a day that does not exist.
          return parsed.toISOString().slice(0, 10) === value;
        },
        defaultMessage(): string {
          return 'date must be a real calendar date';
        },
      },
    });
  };
}

export class CreateTourDto {
  // The service also rejects a date in the past.
  //
  // IsRealCalendarDate as well as the shape check: the regex alone accepts
  // 2030-02-31, which then survives the service's string comparison and only
  // fails inside Postgres, turning a 400 into a 500.
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be YYYY-MM-DD',
  })
  @IsRealCalendarDate()
  date: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be HH:MM',
  })
  startTime: string;

  @IsInt()
  @Min(1)
  @Max(99)
  capacity: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  meetingPoint: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  pace: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
