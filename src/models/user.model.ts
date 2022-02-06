import { Field, ObjectType } from '@nestjs/graphql';
import { Roles } from 'src/common/enums/roles';
import { BaseModel } from './base.model';

@ObjectType()
export class User extends BaseModel {
  rcno: number;
  fullName: string;
  userId: string;
  email: string;
  roles?: Roles[];
}
