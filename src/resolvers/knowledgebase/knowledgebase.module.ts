import { Module } from '@nestjs/common';
import { RedisCacheModule } from 'src/redisCache.module';
import { KnowledgebaseService } from 'src/services/knowledgebase.service';
import { UserModule } from '../user/user.module';
import { KnowledgebaseResolver } from './knowledgebase.resolver';

@Module({
  imports: [RedisCacheModule, UserModule],
  providers: [KnowledgebaseResolver, KnowledgebaseService],
  exports: [KnowledgebaseService],
})
export class KnowledgebaseModule {}
