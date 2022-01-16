import { Module } from '@nestjs/common';
import { RedisCacheModule } from 'src/redisCache.module';
import { TicketService } from 'src/services/ticket.service';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { CategoryResolver } from './category.resolver';
import { TicketResolver } from './ticket.resolver';

@Module({
  imports: [RedisCacheModule, UserModule, NotificationModule],
  providers: [CategoryResolver, TicketResolver, TicketService],
  exports: [TicketService],
})
export class TicketModule {}
