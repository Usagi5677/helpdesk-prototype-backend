import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserEntity } from 'src/decorators/user.decorator';
import { GqlAuthGuard } from 'src/guards/gql-auth.guard';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { User } from 'src/models/user.model';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAttachmentInput } from 'src/resolvers/attachment/dto/create-attachment.input';
import { AttachmentService } from 'src/services/attachment.service';
import { UserService } from 'src/services/user.service';

@Controller('attachment')
export class AttachmentController {
  constructor(
    private prisma: PrismaService,
    private readonly userService: UserService,
    private readonly attachmentService: AttachmentService
  ) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('attachment'))
  async uploadAttachment(
    @Req() req,
    @UploadedFile() attachment: Express.Multer.File,
    @Body() { ticketId, description, isPublic }: CreateAttachmentInput
  ) {
    const user = req.user;
    const isAdminOrAgent = await this.userService.isAdminOrAgent(user.id);
    if (!isAdminOrAgent) {
      // If not an admin or agent, prevent non-followers from uploading attachments to ticket.
      const ticketFollowing = await this.prisma.ticketFollowing.findFirst({
        where: { userId: user.id, ticketId: parseInt(ticketId) },
      });
      if (!ticketFollowing) {
        throw new UnauthorizedException(
          'You do not have access to this ticket.'
        );
      }
    }
    let mode = 'Public';
    if (isAdminOrAgent && isPublic === false) mode = 'Private';
    let newAttachment: any;
    try {
      newAttachment = await this.prisma.ticketAttachment.create({
        data: {
          userId: user.id,
          ticketId: parseInt(ticketId),
          description,
          mode,
        },
      });
      try {
        await this.attachmentService.uploadFile(attachment, {
          name: `${user.rcno}`,
        });
      } catch (error) {
        if (newAttachment?.id) {
          await this.prisma.ticketAttachment.delete({
            where: { id: newAttachment.id },
          });
        }
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }
}
