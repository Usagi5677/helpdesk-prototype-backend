import { Module } from '@nestjs/common';
import { RedisCacheModule } from 'src/redisCache.module';
import { TicketService } from 'src/services/ticket.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { SiteModule } from '../site/site.module';
import { UserModule } from '../user/user.module';
import { CategoryResolver } from './category.resolver';
import { CommentResolver } from './comment.resolver';
import { TicketResolver } from './ticket.resolver';

@Module({
  imports: [
    RedisCacheModule,
    UserModule,
    NotificationModule,
    AuthModule,
    SiteModule,
  ],
  providers: [CategoryResolver, TicketResolver, CommentResolver, TicketService],
  exports: [TicketService],
})
export class TicketModule {}
