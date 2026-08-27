import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { buildTypeOrmOptions, parseSslMode } from './database/typeorm-options';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RoutesModule } from './routes/routes.module';
import { ToursModule } from './tours/tours.module';
import { BookingsModule } from './bookings/bookings.module';
import { GuideModule } from './guide/guide.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildTypeOrmOptions({
          // No fallback: there is no sensible default host to guess at now
          // that the database is a hosted one. buildTypeOrmOptions throws a
          // readable error when this is missing.
          url: config.get<string>('DATABASE_URL'),
          ssl: parseSslMode(config.get<string>('DB_SSL')),
          sslCaPath: config.get<string>('DB_SSL_CA'),
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
    ProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
