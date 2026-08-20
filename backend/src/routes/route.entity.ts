import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum RouteDifficulty {
  EASY = 'Easy',
  MODERATE = 'Moderate',
  HARD = 'Hard',
}

export enum RouteActivity {
  HIKING = 'Hiking',
  BIKING = 'Biking',
}

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: RouteDifficulty })
  difficulty: RouteDifficulty;

  @Column({ type: 'enum', enum: RouteActivity })
  activity: RouteActivity;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  author: User;

  @Column()
  authorId: string;

  // The ordered path as [lat, lng] pairs, read and written whole with the route,
  // so jsonb rather than a join table.
  @Column({ type: 'jsonb' })
  waypoints: [number, number][];

  @CreateDateColumn()
  createdAt: Date;
}
