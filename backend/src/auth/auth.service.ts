import {
  BadRequestException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UsersService } from '../users/users.service';

type TokenPayload = {
  sub: string;
  username: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService
  ) {}

  private get jwtSecret() {
    return this.configService.getOrThrow<string>('JWT_SECRET');
  }

  private validateStrongPassword(password: string) {
    const hasLength = password.length >= 8;
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLength || !hasLetter || !hasNumber) {
      throw new BadRequestException(
        'Password must be at least 8 characters and include letters and numbers'
      );
    }
  }

  async register(username: string, password: string) {
    if (!username?.trim()) {
      throw new BadRequestException('Username is required');
    }

    this.validateStrongPassword(password);

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.createUser(username, passwordHash);

    return this.createAuthResponse(user.id, user.username);
  }

  async login(username: string, password: string) {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return this.createAuthResponse(user.id, user.username);
  }

  verifyAuthorizationHeader(authorization?: string) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch {
      throw new UnauthorizedException('Invalid authorization token');
    }
  }

  private createAuthResponse(userId: string, username: string) {
    const payload: TokenPayload = { sub: userId, username };
    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });

    return {
      token,
      user: { id: userId, username }
    };
  }
}