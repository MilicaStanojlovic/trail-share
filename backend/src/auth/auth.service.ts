import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface PublicUser {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
}

export interface AuthPayload {
  token: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthPayload> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hash(dto.password, 10);
    const user = await this.users.create({
      displayName: dto.displayName,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });

    return this.buildAuthPayload(user);
  }

  async login(dto: LoginDto): Promise<AuthPayload> {
    const user = await this.users.findByEmail(dto.email);
    // Unknown email and wrong password must throw the exact same message so the
    // API does not leak which accounts exist.
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthPayload(user);
  }

  private async buildAuthPayload(user: User): Promise<AuthPayload> {
    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return { token, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    };
  }
}
