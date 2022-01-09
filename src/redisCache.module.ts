import { Module } from '@nestjs/common';
import { RedisCacheService } from './redisCache.service';
import { RedisCacheResolver } from './redisCache.resolver';

@Module({
  providers: [RedisCacheService, RedisCacheResolver],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}
