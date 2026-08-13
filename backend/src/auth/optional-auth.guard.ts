import { ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * This guard never rejects. Any failure - missing Authorization header,
 * malformed header, bad or expired token, deleted user - yields an anonymous
 * request with request.user left unset, and a valid token populates
 * request.user exactly as JwtAuthGuard does. The tour GET endpoints stay
 * public; the service decorates per viewer only when a user is present.
 */
@Injectable()
export class OptionalAuthGuard extends JwtAuthGuard {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(ctx);
    } catch {
      return true;
    }
  }
}
