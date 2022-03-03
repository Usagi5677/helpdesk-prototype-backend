import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationResolver } from './notification.resolver';
import { Module } from '@nestjs/common';
import { NotificationService } from '../../services/notification.service';
import { NotificationProvider } from './notification.provider';
import { BullModule } from '@nestjs/bull';
import { NotificationConsumer } from './notification.consumer';
import { UserModule } from '../user/user.module';
import { KnowledgebaseResolver } from '../knowledgebase/knowledgebase.resolver';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'helpdesk-notification',
    }),
    UserModule,
  ],
  providers: [
    NotificationProvider,
    NotificationService,
    NotificationResolver,
    NotificationConsumer,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
