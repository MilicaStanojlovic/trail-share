import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { buildTypeOrmOptions } from './database/typeorm-options';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RoutesModule } from './routes/routes.module';
import { ToursModule } from './tours/tours.module';
import { BookingsModule } from './bookings/bookings.module';
import { GuideModule } from './guide/guide.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildTypeOrmOptions({
          host: config.get<string>('DB_HOST', 'localhost'),
          port: config.get<number>('DB_PORT', 5432),
          user: config.get<string>('DB_USER', 'postgres'),
          password: config.get<string>('DB_PASSWORD', 'postgres'),
          // trailshare_dev, never trailshare: an unrelated Flyway-managed
          // `trailshare` database exists on dev machines here, and this app's
          // migrations would run against its tables. A wrong default is
          // destructive, so this fallback must stay in step with .env.example.
          name: config.get<string>('DB_NAME', 'trailshare_dev'),
        }),
        autoLoadEntities: true,
        // Apply pending migrations on boot, so a fresh clone or a fresh
        // database only ever needs `npm run start:dev`. There is no
        // `synchronize` counterpart any more — see typeorm-options.ts.
        migrationsRun: true,
      }),
    }),
    UsersModule,
    AuthModule,
    RoutesModule,
    ToursModule,
    BookingsModule,
    GuideModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
