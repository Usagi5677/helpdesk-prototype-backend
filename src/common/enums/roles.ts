import { registerEnumType } from '@nestjs/graphql';

export enum Roles {
  Admin = 'Admin',
  Agent = 'Agent',
}

registerEnumType(Roles, {
  name: 'Roles',
  description: 'All user roles.',
});
