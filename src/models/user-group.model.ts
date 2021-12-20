import { ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.model';
import { User } from './user.model';

@ObjectType()
export class UserGroup extends BaseModel {
  name: string;
  mode: string;
  createdBy?: User;
  users?: User[];
}
