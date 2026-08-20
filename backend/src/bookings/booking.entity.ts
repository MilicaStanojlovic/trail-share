import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Tour } from '../tours/tour.entity';
import { User } from '../users/user.entity';

export type BookingStatus = 'CONFIRMED' | 'PAID';

@Entity('bookings')
// The unique constraint on (tourId, hikerId) is the race-safe double-book
// check: a concurrent second insert fails with Postgres error 23505, which the
// service turns into a 409, so no pre-SELECT is needed.
@Unique(['tourId', 'hikerId'])
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tour, { nullable: false, onDelete: 'CASCADE' })
  tour: Tour;

  @Column()
  tourId: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  hiker: User;

  @Column()
  hikerId: string;

  @Column({ type: 'varchar', length: 16, default: 'CONFIRMED' })
  status: BookingStatus;

  @CreateDateColumn()
  createdAt: Date;
}
