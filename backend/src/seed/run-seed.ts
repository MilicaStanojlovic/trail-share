import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { seedDatabase } from './seed';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  const { usersCreated, routesCreated } = await seedDatabase(dataSource);
  console.log(
    `Seed complete: ${usersCreated} users created, ${routesCreated} routes created`,
  );

  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
