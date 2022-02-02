import { ObjectType } from '@nestjs/graphql';
import RelayTypes from '../../common/pagination/relay-types';
import { Ticket } from '../ticket.model';

@ObjectType()
export class PaginatedTickets extends RelayTypes<Ticket>(Ticket) {}
