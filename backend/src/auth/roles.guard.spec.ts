import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { UserRole } from '../users/user.entity';
import { RolesGuard } from './roles.guard';

function buildCtx(request: Request): ExecutionContext {
  return {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const getAllAndOverride = jest.fn<unknown, [string, unknown[]]>();

  const reflector = { getAllAndOverride } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  beforeEach(() => {
    getAllAndOverride.mockReset();
  });

  it('allows access when no roles metadata is set', () => {
    getAllAndOverride.mockReturnValue(undefined);
    const request = {} as unknown as Request;

    const result = guard.canActivate(buildCtx(request));

    expect(result).toBe(true);
  });

  it('allows access when the user has a required role', () => {
    getAllAndOverride.mockReturnValue([UserRole.GUIDE]);
    const request = {
      user: { role: UserRole.GUIDE },
    } as unknown as Request;

    const result = guard.canActivate(buildCtx(request));

    expect(result).toBe(true);
  });

  it('denies access when the user has a different role', () => {
    getAllAndOverride.mockReturnValue([UserRole.GUIDE]);
    const request = {
      user: { role: UserRole.HIKER },
    } as unknown as Request;

    expect(() => guard.canActivate(buildCtx(request))).toThrow(
      ForbiddenException,
    );
  });

  it('denies access when the request has no user', () => {
    getAllAndOverride.mockReturnValue([UserRole.GUIDE]);
    const request = {} as unknown as Request;

    expect(() => guard.canActivate(buildCtx(request))).toThrow(
      ForbiddenException,
    );
  });
});
