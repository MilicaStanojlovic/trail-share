import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from '../routes/route.entity';
import { User } from '../users/user.entity';
import { Tour } from './tour.entity';
import { ToursService } from './tours.service';

@Module({
  imports: [TypeOrmModule.forFeature([Tour, Route, User])],
  controllers: [],
  providers: [ToursService],
  exports: [ToursService],
})
export class ToursModule {}
