import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from '../routes/route.entity';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { Tour } from './tour.entity';
import { RouteToursController } from './route-tours.controller';
import { ToursController } from './tours.controller';
import { ToursService } from './tours.service';

@Module({
  // JwtAuthGuard (on POST /routes/:routeId/tours) is instantiated in this
  // module's own injector, so its UsersService dependency has to be resolvable
  // here. JwtService needs no import: JwtModule is registered globally.
  imports: [TypeOrmModule.forFeature([Tour, Route, User]), UsersModule],
  controllers: [ToursController, RouteToursController],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}
