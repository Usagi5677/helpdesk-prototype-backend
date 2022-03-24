import { UserResolver } from './user.resolver';
import { forwardRef, Module } from '@nestjs/common';
import { UserService } from '../../services/user.service';
import { RedisCacheModule } from 'src/redisCache.module';
import { UserGroupResolver } from './user-group.resolver';
import { SearchResolver } from './search.resolver';
import { APSService } from 'src/services/aps.service';
import { APSModule } from '../profile/profile.module';
import { SiteModule } from '../site/site.module';

@Module({
  imports: [
    forwardRef(() => RedisCacheModule),
    forwardRef(() => APSModule),
    SiteModule,
  ],
  providers: [
    UserResolver,
    UserGroupResolver,
    SearchResolver,
    UserService,
    APSService,
  ],
  exports: [UserService],
})
export class UserModule {}
