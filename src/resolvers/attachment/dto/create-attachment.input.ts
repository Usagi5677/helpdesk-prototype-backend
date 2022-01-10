import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateAttachmentInput {
  @Field(() => Int)
  ticketId: string;
  description: string;
  @Field({ nullable: true })
  isPublic: boolean;
}
