import { UserResolver } from './user.resolver';
import { Module } from '@nestjs/common';
import { UserService } from '../../services/user.service';
import { RedisCacheModule } from 'src/redisCache.module';
import { UserGroupResolver } from './user-group.resolver';
import { SearchResolver } from './search.resolver';
import { APSService } from 'src/services/aps.service';
import { APSModule } from '../profile/profile.module';

@Module({
  imports: [RedisCacheModule, RedisCacheModule, APSModule],
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
