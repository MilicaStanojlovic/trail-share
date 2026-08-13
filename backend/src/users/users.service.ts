import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  create(data: {
    displayName: string;
    email: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    const user = this.users.create(data);
    return this.users.save(user);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: email.trim().toLowerCase() },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }
}
