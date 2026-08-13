import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { Route, RouteDifficulty, RouteActivity } from '../routes/route.entity';

interface SeedUser {
  displayName: string;
  email: string;
  role: UserRole;
}

interface SeedRoute {
  name: string;
  difficulty: RouteDifficulty;
  activity: RouteActivity;
  author: string;
  description: string;
  waypoints: [number, number][];
}

interface SeedData {
  users: SeedUser[];
  routes: SeedRoute[];
}

// Every seeded user gets this password so a human can sign in as
// ivana@trailshare.hr.
export const SEED_PASSWORD = 'trailshare1';

export async function seedDatabase(
  dataSource: DataSource,
): Promise<{ usersCreated: number; routesCreated: number }> {
  // Relative path resolves to the repo root both from src/seed under ts-node
  // and ts-jest and from dist/seed after nest build.
  const raw = readFileSync(
    join(__dirname, '..', '..', '..', 'docs', 'seed-data.json'),
    'utf8',
  );
  const data = JSON.parse(raw) as SeedData;

  const userRepository = dataSource.getRepository(User);
  const routeRepository = dataSource.getRepository(Route);

  let usersCreated = 0;
  let routesCreated = 0;

  const passwordHash = await hash(SEED_PASSWORD, 10);

  const userByDisplayName = new Map<string, User>();

  for (const seedUser of data.users) {
    const email = seedUser.email.toLowerCase().trim();
    let user = await userRepository.findOne({ where: { email } });

    if (!user) {
      user = await userRepository.save({
        displayName: seedUser.displayName,
        email,
        passwordHash,
        role: seedUser.role,
      });
      usersCreated += 1;
    }

    userByDisplayName.set(seedUser.displayName, user);
  }

  // Insert routes sequentially so createdAt ascends in JSON order; this keeps
  // Medvednica Ridge Loop the oldest route and therefore the featured one.
  for (const seedRoute of data.routes) {
    const existingRoute = await routeRepository.findOne({
      where: { name: seedRoute.name },
    });
    if (existingRoute) {
      continue;
    }

    const author = userByDisplayName.get(seedRoute.author);
    if (!author) {
      throw new Error(
        `Route "${seedRoute.name}" references unknown author "${seedRoute.author}"`,
      );
    }

    await routeRepository.save({
      name: seedRoute.name,
      description: seedRoute.description,
      difficulty: seedRoute.difficulty,
      activity: seedRoute.activity,
      authorId: author.id,
      waypoints: seedRoute.waypoints,
    });
    routesCreated += 1;
  }

  return { usersCreated, routesCreated };
}
