import { UserResolver } from './user.resolver';
import { Module } from '@nestjs/common';
import { UserService } from '../../services/user.service';

@Module({
  imports: [],
  providers: [UserResolver, UserService],
})
export class UserModule {}
