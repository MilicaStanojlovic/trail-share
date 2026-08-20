import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { hash } from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { Route, RouteDifficulty, RouteActivity } from '../routes/route.entity';
import { Tour } from '../tours/tour.entity';
import { Booking, BookingStatus } from '../bookings/booking.entity';

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

interface SeedBooking {
  // The tour's id in docs/seed-data.json, not a database id.
  tourId: number;
  hiker: string;
  status: BookingStatus;
  daysAgo: number;
}

// These live in code rather than in docs/seed-data.json, which stays verbatim
// design data: the design shows rosters but carries no booking records. Every
// roster name the design spec lists appears here, with mixed statuses and
// staggered ages so the "booked n days ago" line varies on screen.
const SEED_BOOKINGS: SeedBooking[] = [
  { tourId: 1, hiker: 'Luka Horvat', status: 'PAID', daysAgo: 5 },
  { tourId: 1, hiker: 'Ana Perić', status: 'CONFIRMED', daysAgo: 4 },
  { tourId: 1, hiker: 'Tomislav Rukavina', status: 'PAID', daysAgo: 3 },
  { tourId: 1, hiker: 'Maja Šimić', status: 'CONFIRMED', daysAgo: 2 },
  { tourId: 2, hiker: 'Filip Barišić', status: 'PAID', daysAgo: 6 },
  { tourId: 2, hiker: 'Nina Vuković', status: 'CONFIRMED', daysAgo: 5 },
  { tourId: 3, hiker: 'Dario Klarić', status: 'CONFIRMED', daysAgo: 3 },
  { tourId: 3, hiker: 'Sara Jurić', status: 'PAID', daysAgo: 2 },
  { tourId: 4, hiker: 'Luka Horvat', status: 'CONFIRMED', daysAgo: 1 },
  { tourId: 5, hiker: 'Ana Perić', status: 'CONFIRMED', daysAgo: 1 },
];

export async function seedDatabase(dataSource: DataSource): Promise<{
  usersCreated: number;
  routesCreated: number;
  toursCreated: number;
  bookingsCreated: number;
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
  const bookingRepository = dataSource.getRepository(Booking);

  let usersCreated = 0;
  let routesCreated = 0;
  let toursCreated = 0;
  let bookingsCreated = 0;

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
  const tourByJsonId = new Map<number, Tour>();
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
      // Mapped before the skip, like routes are: a re-run must still resolve
      // the tours the bookings below reference.
      tourByJsonId.set(seedTour.id, existingTour);
      continue;
    }

    const savedTour = await tourRepository.save({
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
    tourByJsonId.set(seedTour.id, savedTour);
  }

  // Seeded bookings deliberately do not reconcile with bookedCount: the counter
  // is the denormalized number the design shows, and the design's counts exceed
  // the number of hiker users it defines. Nothing here touches bookedCount, and
  // the cancel path floors its decrement at zero for exactly this reason.
  for (const seedBooking of SEED_BOOKINGS) {
    const tour = tourByJsonId.get(seedBooking.tourId);
    if (!tour) {
      throw new Error(`Booking references unknown tour ${seedBooking.tourId}`);
    }

    const hiker = userByDisplayName.get(seedBooking.hiker);
    if (!hiker) {
      throw new Error(
        `Booking on tour ${seedBooking.tourId} references unknown hiker "${seedBooking.hiker}"`,
      );
    }

    const existingBooking = await bookingRepository.findOne({
      where: { tourId: tour.id, hikerId: hiker.id },
    });
    if (existingBooking) {
      continue;
    }

    const createdAt = new Date(Date.now() - seedBooking.daysAgo * 86_400_000);
    const savedBooking = await bookingRepository.save({
      tourId: tour.id,
      hikerId: hiker.id,
      status: seedBooking.status,
      createdAt,
    });
    // A @CreateDateColumn is written by the driver on insert, so the staggered
    // timestamp is applied afterwards; without it every roster row would read
    // "booked today".
    await bookingRepository.update(savedBooking.id, { createdAt });
    bookingsCreated += 1;
  }

  return { usersCreated, routesCreated, toursCreated, bookingsCreated };
}
