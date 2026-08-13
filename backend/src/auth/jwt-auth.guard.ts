import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UsersService } from '../users/users.service';
import { AuthUser, JwtPayload } from './auth-user';

type RequestWithUser = Request & { user?: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException();
    }

    const parts = authHeader.split(' ');
    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !== 'bearer' ||
      parts[1].length === 0
    ) {
      throw new UnauthorizedException();
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(parts[1]);
    } catch {
      throw new UnauthorizedException();
    }

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    };

    return true;
  }
}
