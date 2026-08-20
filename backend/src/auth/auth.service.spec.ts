import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService, type AuthPayload } from './auth.service';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

type UsersServiceMock = jest.Mocked<
  Pick<UsersService, 'create' | 'findByEmail' | 'findById'>
>;

type JwtServiceMock = jest.Mocked<Pick<JwtService, 'signAsync'>>;

describe('AuthService', () => {
  const usersMock: UsersServiceMock = {
    create: jest.fn(),
    findByEmail: jest.fn(),
    findById: jest.fn(),
  };

  const jwtMock: JwtServiceMock = {
    signAsync: jest.fn(),
  };

  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    const dto: RegisterDto = {
      displayName: 'Alice',
      email: 'alice@example.com',
      password: 'Password1',
      role: UserRole.HIKER,
    };

    const createdUser: User = {
      id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      displayName: dto.displayName,
      email: dto.email,
      passwordHash: 'stored-hash',
      role: dto.role,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    const publicUser = {
      id: createdUser.id,
      displayName: createdUser.displayName,
      email: createdUser.email,
      role: createdUser.role,
    };

    it('hashes the password and returns the auth payload', async () => {
      usersMock.findByEmail.mockResolvedValue(null);
      usersMock.create.mockResolvedValue(createdUser);
      jwtMock.signAsync.mockResolvedValue('signed-token');

      const result: AuthPayload = await service.register(dto);

      expect(usersMock.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(usersMock.create).toHaveBeenCalledTimes(1);

      const createCall = usersMock.create.mock.calls[0][0];
      expect(createCall.passwordHash).not.toBe(dto.password);
      await expect(
        compare(dto.password, createCall.passwordHash),
      ).resolves.toBe(true);

      expect(result).toEqual({ token: 'signed-token', user: publicUser });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(jwtMock.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: createdUser.id,
          email: createdUser.email,
          role: createdUser.role,
        }),
      );
    });

    it('throws ConflictException when the email is already registered', async () => {
      usersMock.findByEmail.mockResolvedValue(createdUser);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      await expect(service.register(dto)).rejects.toThrow(
        'Email is already registered',
      );
    });
  });

  describe('login', () => {
    const email = 'alice@example.com';
    const plaintextPassword = 'Password1';

    let storedUser: User;

    beforeAll(async () => {
      const passwordHash = await hash(plaintextPassword, 10);
      storedUser = {
        id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        displayName: 'Alice',
        email,
        passwordHash,
        role: UserRole.HIKER,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      };
    }, 20000);

    it('resolves with a token and public user when the password is correct', async () => {
      usersMock.findByEmail.mockResolvedValue(storedUser);
      jwtMock.signAsync.mockResolvedValue('signed-token');

      const loginDto: LoginDto = { email, password: plaintextPassword };
      const result: AuthPayload = await service.login(loginDto);

      expect(result.token).toBe('signed-token');
      expect(result.user).toEqual({
        id: storedUser.id,
        displayName: storedUser.displayName,
        email: storedUser.email,
        role: storedUser.role,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(jwtMock.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: storedUser.id,
          email: storedUser.email,
          role: storedUser.role,
        }),
      );
    }, 20000);

    it('rejects with UnauthorizedException when the password is wrong', async () => {
      usersMock.findByEmail.mockResolvedValue(storedUser);

      const loginDto: LoginDto = { email, password: 'WrongPassword' };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid email or password',
      );
    }, 20000);

    it('rejects with UnauthorizedException when the email is unknown', async () => {
      usersMock.findByEmail.mockResolvedValue(null);

      const loginDto: LoginDto = { email, password: plaintextPassword };

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.login(loginDto)).rejects.toThrow(
        'Invalid email or password',
      );
    });
  });
});
