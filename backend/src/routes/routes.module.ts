import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { Route } from './route.entity';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  // JwtAuthGuard (on POST /routes) is instantiated in this module's own
  // injector, so its UsersService dependency has to be resolvable here.
  // JwtService needs no import: JwtModule is registered globally.
  imports: [TypeOrmModule.forFeature([Route]), UsersModule],
  controllers: [RoutesController],
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
