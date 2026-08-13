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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateTourDto } from './dto/create-tour.dto';
import type { TourDto } from './dto/tour-dto';
import { ToursService } from './tours.service';

@Controller('routes/:routeId/tours')
export class RouteToursController {
  constructor(private readonly toursService: ToursService) {}

  @Get()
  listForRoute(
    @Param('routeId', ParseUUIDPipe) routeId: string,
  ): Promise<TourDto[]> {
    return this.toursService.findForRoute(routeId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('GUIDE')
  create(
    @Param('routeId', ParseUUIDPipe) routeId: string,
    @Body() dto: CreateTourDto,
    @CurrentUser() user: AuthUser,
  ): Promise<TourDto> {
    return this.toursService.create(routeId, dto, user.id);
  }
}
