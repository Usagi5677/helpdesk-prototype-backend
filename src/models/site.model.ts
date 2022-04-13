import { ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.model';

@ObjectType()
export class Site extends BaseModel {
  name: string;
  code: string;
  mode: string;
  isEnabled: boolean;
}
