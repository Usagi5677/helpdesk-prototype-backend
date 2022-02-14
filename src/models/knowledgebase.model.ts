import { ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.model';
import { User } from './user.model';

@ObjectType()
export class Knowledgebase extends BaseModel {
  createdBy: User;
  mode: string;
  title: string;
  body: string;
}
