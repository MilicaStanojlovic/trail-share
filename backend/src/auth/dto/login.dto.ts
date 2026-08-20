import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  // Deliberately no length or digit rule here: applying registration strength
  // rules on login would lock out existing accounts.
  @IsString()
  @IsNotEmpty()
  password: string;
}
