import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ListRoutesQueryDto } from './dto/list-routes-query.dto';
import { RouteDto } from './dto/route-dto';
import { RoutesService } from './routes.service';

@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Get()
  list(@Query() query: ListRoutesQueryDto): Promise<RouteDto[]> {
    return this.routesService.findAll(query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<RouteDto> {
    return this.routesService.findById(id);
  }
}
