import { Module } from '@nestjs/common';
import { RedisCacheModule } from 'src/redisCache.module';
import { TicketService } from 'src/services/ticket.service';
import { UserModule } from '../user/user.module';
import { CategoryResolver } from './category.resolver';

@Module({
  imports: [RedisCacheModule, UserModule],
  providers: [CategoryResolver, TicketService],
  exports: [TicketService],
})
export class TicketModule {}
