import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RouteDifficulty } from '../route.entity';

export class ListRoutesQueryDto {
  @IsOptional()
  @IsEnum(RouteDifficulty)
  difficulty?: RouteDifficulty;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
