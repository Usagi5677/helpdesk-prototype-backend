import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from './../prisma/prisma.service';
import { SecurityConfig } from '../configs/config.interface';
import { Token } from '../models/token.model';
import { APSService } from './aps.service';
import { UserService } from './user.service';
import { RedisCacheService } from 'src/redisCache.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly APSService: APSService,
    private readonly userService: UserService,
    private readonly redisCacheService: RedisCacheService
  ) {}

  async validateUser(uuid: string): Promise<User> {
    // First check cache
    let user = await this.redisCacheService.get(`user-uuid-${uuid}`);
    if (!user) {
      // If not in cache, call database
      user = await this.prisma.user.findUnique({ where: { userId: uuid } });
      if (!user) {
        // If user not found in helpdesk system database, call APS
        const profile = await this.APSService.getProfile(uuid);
        // Create new user based on APS response
        user = await this.userService.createUser(
          profile.rcno,
          profile.userId,
          profile.fullName,
          profile.email
        );
        if (!user) {
          throw new BadRequestException('Invalid user.');
        }
      }
      await this.redisCacheService.setForMonth(`user-uuid-${uuid}`, user);
    }
    return user;
  }

  getUserFromToken(token: string): Promise<User> {
    const id = this.jwtService.decode(token)['id'];
    return this.prisma.user.findUnique({ where: { id } });
  }

  generateTokens(payload: { userId: string }): Token {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  private generateAccessToken(payload: { userId: string }): string {
    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(payload: { userId: string }): string {
    const securityConfig = this.configService.get<SecurityConfig>('security');
    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: securityConfig.refreshIn,
    });
  }

  refreshToken(token: string) {
    try {
      const { userId } = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      return this.generateTokens({
        userId,
      });
    } catch (e) {
      throw new UnauthorizedException();
    }
  }
}
