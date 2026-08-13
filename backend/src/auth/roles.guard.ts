import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthUser } from './auth-user';
import { ROLES_KEY } from './roles.decorator';

type RequestWithUser = Request & { user?: AuthUser };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    if (!request.user || !roles.includes(request.user.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
