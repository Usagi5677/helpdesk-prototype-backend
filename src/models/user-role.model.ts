import { ObjectType } from '@nestjs/graphql';
import { RoleEnum } from 'src/common/enums/roles';
import { Site } from './site.model';

@ObjectType()
export class UserRole {
  role: RoleEnum;
  site: Site;
}
