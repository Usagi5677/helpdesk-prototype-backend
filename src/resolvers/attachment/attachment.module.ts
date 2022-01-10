import { PrismaModule } from '../../prisma/prisma.module';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AttachmentService } from 'src/services/attachment.service';
import { AttachmentController } from 'src/controllers/attachment.controller';
import { RedisCacheModule } from 'src/redisCache.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [PrismaModule, HttpModule, RedisCacheModule, UserModule],
  controllers: [AttachmentController],
  providers: [AttachmentService],
  exports: [AttachmentService],
})
export class AttachmentModule {}
