import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from '../routes/route.entity';
import { Tour } from '../tours/tour.entity';
import { UsersModule } from '../users/users.module';
import { GuideController } from './guide.controller';
import { GuideService } from './guide.service';

@Module({
  // JwtAuthGuard on the dashboard endpoint is instantiated in this module's own
  // injector, so its UsersService dependency has to be resolvable here.
  // JwtService needs no import: JwtModule is registered globally.
  imports: [TypeOrmModule.forFeature([Tour, Route]), UsersModule],
  controllers: [GuideController],
  providers: [GuideService],
})
export class GuideModule {}
