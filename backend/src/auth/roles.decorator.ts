import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.entity';

export const ROLES_KEY = 'roles';

type UserRoleLiteral = `${UserRole}`;

export const Roles = (...roles: UserRoleLiteral[]) =>
  SetMetadata(ROLES_KEY, roles);
