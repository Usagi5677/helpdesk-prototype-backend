import { ObjectType } from '@nestjs/graphql';
import { Site } from './site.model';
import { UserRole } from './user-role.model';

@ObjectType()
export class UserWithRolesAndSites {
  id: number;
  rcno: number;
  fullName: string;
  userId: string;
  email: string;
  roles: UserRole[];
  isSuperAdmin: boolean;
  sites: Site[];
}
