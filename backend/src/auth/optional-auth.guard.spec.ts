import type { ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UserRole } from '../users/user.entity';
import type { UsersService } from '../users/users.service';
import type { AuthUser } from './auth-user';
import { OptionalAuthGuard } from './optional-auth.guard';

type RequestWithUser = Request & { user?: AuthUser };

function buildCtx(request: RequestWithUser): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('OptionalAuthGuard', () => {
  const verifyAsync = jest.fn<Promise<unknown>, [string]>();
  const findById = jest.fn<Promise<unknown>, [string]>();

  const jwtMock = { verifyAsync } as unknown as JwtService;
  const usersMock = { findById } as unknown as UsersService;

  const guard = new OptionalAuthGuard(jwtMock, usersMock);

  beforeEach(() => {
    verifyAsync.mockReset();
    findById.mockReset();
  });

  it('allows anonymous requests with no Authorization header', async () => {
    const request: RequestWithUser = { headers: {} } as RequestWithUser;

    const result = await guard.canActivate(buildCtx(request));

    expect(result).toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('allows anonymous requests with a malformed or invalid token', async () => {
    const request: RequestWithUser = {
      headers: { authorization: 'Bearer garbage' },
    } as unknown as RequestWithUser;
    verifyAsync.mockRejectedValue(new Error('bad token'));

    const result = await guard.canActivate(buildCtx(request));

    expect(result).toBe(true);
    expect(request.user).toBeUndefined();
    expect(findById).not.toHaveBeenCalled();
  });

  it('populates request.user when the token is valid and the user exists', async () => {
    const request: RequestWithUser = {
      headers: { authorization: 'Bearer valid-token' },
    } as unknown as RequestWithUser;
    verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'luka@trailshare.hr',
      role: UserRole.HIKER,
    });
    findById.mockResolvedValue({
      id: 'user-1',
      displayName: 'Luka Horvat',
      email: 'luka@trailshare.hr',
      passwordHash: 'hashed',
      role: UserRole.HIKER,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await guard.canActivate(buildCtx(request));

    expect(result).toBe(true);
    expect(request.user).toEqual({
      id: 'user-1',
      displayName: 'Luka Horvat',
      email: 'luka@trailshare.hr',
      role: UserRole.HIKER,
    });
  });

  it('allows anonymous requests when the token is valid but the user was deleted', async () => {
    const request: RequestWithUser = {
      headers: { authorization: 'Bearer valid-token' },
    } as unknown as RequestWithUser;
    verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'luka@trailshare.hr',
      role: UserRole.HIKER,
    });
    findById.mockResolvedValue(null);

    const result = await guard.canActivate(buildCtx(request));

    expect(result).toBe(true);
    expect(request.user).toBeUndefined();
  });
});
