import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { Route, RouteDifficulty, RouteActivity } from '../routes/route.entity';
import { Tour } from '../tours/tour.entity';

interface SeedUser {
  displayName: string;
  email: string;
  role: UserRole;
}

interface SeedRoute {
  id: number;
  name: string;
  difficulty: RouteDifficulty;
  activity: RouteActivity;
  author: string;
  description: string;
  waypoints: [number, number][];
}

// The JSON's designTimeRange is deliberately not declared here: those ranges
// are display fiction, and end times are computed from the route's duration.
interface SeedTour {
  id: number;
  routeId: number;
  guide: string;
  date: string;
  startTime: string;
  capacity: number;
  booked: number;
  meetingPoint: string;
  pace: string;
  notes: string;
}

interface SeedData {
  users: SeedUser[];
  routes: SeedRoute[];
  tours: SeedTour[];
}

// Every seeded user gets this password so a human can sign in as
// ivana@trailshare.hr.
export const SEED_PASSWORD = 'trailshare1';

export async function seedDatabase(dataSource: DataSource): Promise<{
  usersCreated: number;
  routesCreated: number;
  toursCreated: number;
}> {
  // Relative path resolves to the repo root both from src/seed under ts-node
  // and ts-jest and from dist/seed after nest build.
  const raw = readFileSync(
    join(__dirname, '..', '..', '..', 'docs', 'seed-data.json'),
    'utf8',
  );
  const data = JSON.parse(raw) as SeedData;

  const userRepository = dataSource.getRepository(User);
  const routeRepository = dataSource.getRepository(Route);
  const tourRepository = dataSource.getRepository(Tour);

  let usersCreated = 0;
  let routesCreated = 0;
  let toursCreated = 0;

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
  const routeByJsonId = new Map<number, Route>();
  for (const seedRoute of data.routes) {
    const existingRoute = await routeRepository.findOne({
      where: { name: seedRoute.name },
    });
    if (existingRoute) {
      routeByJsonId.set(seedRoute.id, existingRoute);
      continue;
    }

    const author = userByDisplayName.get(seedRoute.author);
    if (!author) {
      throw new Error(
        `Route "${seedRoute.name}" references unknown author "${seedRoute.author}"`,
      );
    }

    const savedRoute = await routeRepository.save({
      name: seedRoute.name,
      description: seedRoute.description,
      difficulty: seedRoute.difficulty,
      activity: seedRoute.activity,
      authorId: author.id,
      waypoints: seedRoute.waypoints,
    });
    routesCreated += 1;
    routeByJsonId.set(seedRoute.id, savedRoute);
  }

  // A tour is identified by its route, date and start time — the JSON has no
  // stable key of its own, and no route runs twice at the same moment.
  for (const seedTour of data.tours) {
    const route = routeByJsonId.get(seedTour.routeId);
    if (!route) {
      throw new Error(
        `Tour ${seedTour.id} references unknown route ${seedTour.routeId}`,
      );
    }

    const guide = userByDisplayName.get(seedTour.guide);
    if (!guide) {
      throw new Error(
        `Tour ${seedTour.id} references unknown guide "${seedTour.guide}"`,
      );
    }

    const existingTour = await tourRepository.findOne({
      where: {
        routeId: route.id,
        date: seedTour.date,
        startTime: seedTour.startTime,
      },
    });
    if (existingTour) {
      continue;
    }

    await tourRepository.save({
      routeId: route.id,
      guideId: guide.id,
      date: seedTour.date,
      startTime: seedTour.startTime,
      capacity: seedTour.capacity,
      bookedCount: seedTour.booked,
      meetingPoint: seedTour.meetingPoint,
      pace: seedTour.pace,
      notes: seedTour.notes,
    });
    toursCreated += 1;
  }

  return { usersCreated, routesCreated, toursCreated };
}
