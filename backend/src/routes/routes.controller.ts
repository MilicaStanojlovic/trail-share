import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRouteDto } from './dto/create-route.dto';
import { ListRoutesQueryDto } from './dto/list-routes-query.dto';
import { RouteDto } from './dto/route-dto';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body() dto: CreateRouteDto,
    @CurrentUser() user: AuthUser,
  ): Promise<RouteDto> {
    return this.routesService.create(dto, user.id);
  }

  @Get()
  list(@Query() query: ListRoutesQueryDto): Promise<RouteDto[]> {
    return this.routesService.findAll(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<RouteDto> {
    return this.routesService.findById(id);
  }
}
