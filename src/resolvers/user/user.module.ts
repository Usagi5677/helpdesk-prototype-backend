import { UserResolver } from './user.resolver';
import { Module } from '@nestjs/common';
import { UserService } from '../../services/user.service';
import { RedisCacheModule } from 'src/redisCache.module';
import { UserGroupResolver } from './user-group.resolver';

@Module({
  imports: [RedisCacheModule],
  providers: [UserResolver, UserGroupResolver, UserService],
  exports: [UserService],
})
export class UserModule {}
