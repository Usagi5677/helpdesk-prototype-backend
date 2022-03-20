import { ObjectType } from '@nestjs/graphql';
import { RoleEnum } from 'src/common/enums/roles';
import { BaseModel } from './base.model';
import { UserRole } from './user-role.model';

@ObjectType()
export class User extends BaseModel {
  rcno: number;
  fullName: string;
  userId: string;
  email: string;
  roles?: UserRole[];
  isSuperAdmin: boolean;
}
