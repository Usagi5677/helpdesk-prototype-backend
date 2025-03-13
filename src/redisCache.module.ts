import { forwardRef, Module } from '@nestjs/common';
import { RedisCacheService } from './redisCache.service';
import { RedisCacheResolver } from './redisCache.resolver';
import { UserModule } from './resolvers/user/user.module';
import { UserService } from './services/user.service';
import { APSModule } from './resolvers/profile/profile.module';
import { SiteModule } from './resolvers/site/site.module';

@Module({
  imports: [
    forwardRef(() => UserModule),
    //forwardRef(() => APSModule),
    forwardRef(() => SiteModule),
  ],
  providers: [RedisCacheService, RedisCacheResolver, UserService],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}
