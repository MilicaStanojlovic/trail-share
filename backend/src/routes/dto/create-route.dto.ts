import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { RouteActivity, RouteDifficulty } from '../route.entity';

export function IsLatLngPair(
  validationOptions?: ValidationOptions,
): (object: object, propertyName: string) => void {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isLatLngPair',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (!Array.isArray(value) || value.length !== 2) {
            return false;
          }

          const [lat, lng] = value as unknown[];

          if (typeof lat !== 'number' || typeof lng !== 'number') {
            return false;
          }

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return false;
          }

          return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        },
        defaultMessage(): string {
          return 'each waypoint must be a [lat, lng] pair with lat in [-90, 90] and lng in [-180, 180]';
        },
      },
    });
  };
}

export class CreateRouteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(RouteDifficulty)
  difficulty: RouteDifficulty;

  @IsEnum(RouteActivity)
  activity: RouteActivity;

  @IsArray()
  @ArrayMinSize(2)
  // An explicit upper bound, so the contract states the limit rather than
  // leaving it to Express's body-size default.
  @ArrayMaxSize(2000)
  @IsLatLngPair({ each: true })
  waypoints: [number, number][];
}
