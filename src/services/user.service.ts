import { PrismaService } from 'nestjs-prisma';
import { Injectable, BadRequestException } from '@nestjs/common';
import { PasswordService } from './password.service';
@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}
}
