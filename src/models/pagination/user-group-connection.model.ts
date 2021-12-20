import { ObjectType } from '@nestjs/graphql';
import RelayTypes from '../../common/pagination/relay-types';
import { UserGroup } from '../user-group.model';

@ObjectType()
export class PaginatedUserGroup extends RelayTypes<UserGroup>(UserGroup) {}
