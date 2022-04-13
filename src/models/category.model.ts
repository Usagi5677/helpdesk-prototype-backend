import { ObjectType } from '@nestjs/graphql';
import { BaseModel } from './base.model';
import { Site } from './site.model';

@ObjectType()
export class Category extends BaseModel {
  name: string;
  site?: Site;
}
