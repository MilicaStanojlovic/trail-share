import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions, parseSslMode } from './database/typeorm-options';
import { Booking } from './bookings/booking.entity';
import { Route } from './routes/route.entity';
import { Tour } from './tours/tour.entity';
import { User } from './users/user.entity';

/**
 * The DataSource the TypeORM CLI uses — `npm run migration:generate|run|revert`.
 *
 * This is a third entrypoint alongside main.ts and app.module.ts, and the only
 * other place allowed to read process.env directly: the CLI runs outside the
 * Nest container, so ConfigService does not exist here and `dotenv/config` has
 * to load backend/.env itself.
 *
 * Entities are listed explicitly because `autoLoadEntities` collects them from
 * the feature modules' `forFeature()` calls, and there are no modules here. A
 * new entity must be added to this list or migration:generate will not see it
 * and will happily generate a migration that drops its table.
 */
// Exported as the default and nothing else: the CLI rejects a data source file
// that exports more than one DataSource instance.
const dataSource = new DataSource({
  ...buildTypeOrmOptions({
    url: process.env.DATABASE_URL,
    ssl: parseSslMode(process.env.DB_SSL),
    sslCaPath: process.env.DB_SSL_CA,
  }),
  entities: [User, Route, Tour, Booking],
});

export default dataSource;
