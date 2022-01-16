import { ObjectType } from '@nestjs/graphql';
import { User } from './user.model';

@ObjectType()
export class UserWithRoles extends User {
  roles: string[];
}
