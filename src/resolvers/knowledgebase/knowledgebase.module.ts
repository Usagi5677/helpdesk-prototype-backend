import { Module } from '@nestjs/common';
import { RedisCacheModule } from 'src/redisCache.module';
import { KnowledgebaseService } from 'src/services/knowledgebase.service';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { KnowledgebaseResolver } from './knowledgebase.resolver';

@Module({
  imports: [RedisCacheModule, UserModule, NotificationModule],
  providers: [KnowledgebaseResolver, KnowledgebaseService],
  exports: [KnowledgebaseService],
})
export class KnowledgebaseModule {}
