import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { ProfileDto } from './dto/profile-dto';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  // Always the caller's own profile: the id comes from the token, never from
  // the request, so this endpoint cannot be pointed at another account. No
  // @Roles — a hiker has a profile too, it just carries different stats.
  @Get()
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: AuthUser): Promise<ProfileDto> {
    return this.profileService.getProfile(user);
  }
}
