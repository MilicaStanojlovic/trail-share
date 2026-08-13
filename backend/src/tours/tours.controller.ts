import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { TourDto } from './dto/tour-dto';
import { ToursService } from './tours.service';

@Controller('tours')
export class ToursController {
  constructor(private readonly toursService: ToursService) {}

  @Get()
  list(): Promise<TourDto[]> {
    return this.toursService.findUpcoming();
  }

  // A later slice adding GET /tours/mine must declare it before this wildcard route.
  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<TourDto> {
    return this.toursService.findById(id);
  }
}
