import { ObjectType } from '@nestjs/graphql';
import { UserGroup } from './user-group.model';
import { User } from './user.model';

@ObjectType({ isAbstract: true })
export class SearchResult {
  name: string;
  type: string;
  user?: User;
  userGroup?: UserGroup;
}
