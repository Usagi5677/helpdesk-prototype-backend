import { Module } from '@nestjs/common';
import { RedisCacheModule } from 'src/redisCache.module';
import { TicketService } from 'src/services/ticket.service';
import { UserModule } from '../user/user.module';
import { CategoryResolver } from './category.resolver';
import { TicketResolver } from './ticket.resolver';

@Module({
  imports: [RedisCacheModule, UserModule],
  providers: [CategoryResolver, TicketResolver, TicketService],
  exports: [TicketService],
})
export class TicketModule {}
