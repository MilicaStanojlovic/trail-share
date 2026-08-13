import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import type { GuideDashboardDto } from './dto/guide-dashboard-dto';
import { GuideService } from './guide.service';

@Controller('guide')
export class GuideController {
  constructor(private readonly guideService: GuideService) {}

  // Always the caller's own figures: the id comes from the token, never from
  // the request, so one guide can't read another's dashboard.
  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GUIDE')
  dashboard(@CurrentUser() user: AuthUser): Promise<GuideDashboardDto> {
    return this.guideService.getDashboard(user.id);
  }
}
