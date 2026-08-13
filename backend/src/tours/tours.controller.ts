import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import type { TourDto } from './dto/tour-dto';
import { ToursService } from './tours.service';

@Controller('tours')
export class ToursController {
  constructor(private readonly toursService: ToursService) {}

  // These GET endpoints stay public: OptionalAuthGuard never rejects, and a
  // valid token only makes isBookedByMe real and, for the owning guide, adds
  // the roster.
  @Get()
  @UseGuards(OptionalAuthGuard)
  list(@CurrentUser() user: AuthUser | undefined): Promise<TourDto[]> {
    return this.toursService.findUpcoming(user);
  }

  // A later slice adding GET /tours/mine must declare it before this wildcard route.
  @Get(':id')
  @UseGuards(OptionalAuthGuard)
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<TourDto> {
    return this.toursService.findById(id, user);
  }
}
