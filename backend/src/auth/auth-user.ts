import { UserRole } from '../users/user.entity';

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}
