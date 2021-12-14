import { Module } from '@nestjs/common';
import { RedisCacheModule } from 'src/redisCache.module';
import { ProfileService } from 'src/services/profile.service';

@Module({
  imports: [RedisCacheModule],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
