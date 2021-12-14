import { Module, CacheModule } from '@nestjs/common';
import * as redisStore from 'cache-manager-redis-store';
import { RedisCacheService } from './redisCache.service';
import { RedisCacheResolver } from './redisCache.resolver';

@Module({
  imports: [
    CacheModule.register({
      useFactory: async () => ({
        store: redisStore,
        host: 'localhost',
        port: 6379,
      }),
    }),
  ],
  providers: [RedisCacheService, RedisCacheResolver],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}
