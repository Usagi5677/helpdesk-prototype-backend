import { Module } from '@nestjs/common';
import { RedisCacheModule } from 'src/redisCache.module';
import { SiteService } from 'src/services/site.service';
import { UserModule } from '../user/user.module';
import { SiteResolver } from './site.resolver';

@Module({
  imports: [UserModule, RedisCacheModule],
  providers: [SiteResolver, SiteService],
  exports: [],
})
export class SiteModule {}
