import { forwardRef, Module } from '@nestjs/common';
import { RedisCacheModule } from 'src/redisCache.module';
import { SiteService } from 'src/services/site.service';
import { UserModule } from '../user/user.module';
import { SiteResolver } from './site.resolver';

@Module({
  imports: [forwardRef(() => UserModule), forwardRef(() => RedisCacheModule)],
  providers: [SiteResolver, SiteService],
  exports: [SiteService],
})
export class SiteModule {}
