import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Route } from '../routes/route.entity';
import { User } from '../users/user.entity';

@Entity('tours')
export class Tour {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Route, { nullable: false, onDelete: 'CASCADE' })
  route: Route;

  @Column()
  routeId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  guide: User;

  @Column()
  guideId: string;

  // Postgres date and time both surface as strings in TypeScript and the DTO
  // trims time to HH:MM.
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'int' })
  capacity: number;

  // Denormalized counter kept in step transactionally by the booking flow in a
  // later slice, not a COUNT over bookings, because the seed data has more
  // bookings than there are hiker users.
  @Column({ type: 'int', default: 0 })
  bookedCount: number;

  @Column({ length: 200 })
  meetingPoint: string;

  @Column({ length: 100 })
  pace: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
