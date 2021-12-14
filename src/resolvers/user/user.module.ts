import { UserResolver } from './user.resolver';
import { Module } from '@nestjs/common';
import { UserService } from '../../services/user.service';
import { RedisCacheModule } from 'src/redisCache.module';

@Module({
  imports: [RedisCacheModule],
  providers: [UserResolver, UserService],
  exports: [UserService],
})
export class UserModule {}
