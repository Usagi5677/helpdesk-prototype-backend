import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from './../prisma/prisma.service';
import { SecurityConfig } from '../configs/config.interface';
import { Token } from '../models/token.model';
import { ProfileService } from './profile.service';
import { UserService } from './user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly profileService: ProfileService,
    private readonly userService: UserService
  ) {}

  async validateUser(uuid: string): Promise<User> {
    let user = await this.prisma.user.findUnique({ where: { userId: uuid } });
    if (!user) {
      // If user not found in helpdesk system database, call APS
      const profile = await this.profileService.getProfile(uuid);
      // Create new user based on APS response
      user = await this.userService.createUser(
        profile.rcno,
        profile.userId,
        profile.fullName
      );
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
