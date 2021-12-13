import { ObjectType, registerEnumType, HideField } from '@nestjs/graphql';
import { BaseModel } from './base.model';

@ObjectType()
export class User extends BaseModel {
  rcno: number;
  fullName: string;
  role: string;
  type: string;
}
