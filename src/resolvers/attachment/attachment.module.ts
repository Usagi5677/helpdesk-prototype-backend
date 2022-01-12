import { PrismaModule } from '../../prisma/prisma.module';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AttachmentService } from 'src/services/attachment.service';
import { AttachmentController } from 'src/controllers/attachment.controller';
import { RedisCacheModule } from 'src/redisCache.module';
import { UserModule } from '../user/user.module';
import { TicketModule } from '../ticket/ticket.module';
import { AttachmentResolver } from './attachment.resolver';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    RedisCacheModule,
    UserModule,
    TicketModule,
  ],
  controllers: [AttachmentController],
  providers: [AttachmentService, AttachmentResolver],
  exports: [AttachmentService],
})
export class AttachmentModule {}
