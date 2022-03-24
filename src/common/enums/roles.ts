import { registerEnumType } from '@nestjs/graphql';

export enum RoleEnum {
  Admin = 'Admin',
  Agent = 'Agent',
  User = 'User',
}

registerEnumType(RoleEnum, {
  name: 'Role',
  description: 'All user roles.',
});
