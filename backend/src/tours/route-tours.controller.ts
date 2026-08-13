import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateTourDto } from './dto/create-tour.dto';
import type { TourDto } from './dto/tour-dto';
import { ToursService } from './tours.service';

@Controller('routes/:routeId/tours')
export class RouteToursController {
  constructor(private readonly toursService: ToursService) {}

  @Get()
  @UseGuards(OptionalAuthGuard)
  listForRoute(
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @CurrentUser() user: AuthUser | undefined,
  ): Promise<TourDto[]> {
    return this.toursService.findForRoute(routeId, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GUIDE')
  create(
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Body() dto: CreateTourDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TourDto> {
    return this.toursService.create(routeId, dto, user.id, user);
  }
}
