import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/guards/jwt-auth.guard';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAttachmentInput } from 'src/resolvers/attachment/dto/create-attachment.input';
import { AttachmentService } from 'src/services/attachment.service';
import { UserService } from 'src/services/user.service';
import * as moment from 'moment';
import { extname } from 'path';
import { TicketService } from 'src/services/ticket.service';

@Controller('attachment')
export class AttachmentController {
  constructor(
    private prisma: PrismaService,
    private readonly userService: UserService,
    private readonly attachmentService: AttachmentService,
    private readonly ticketService: TicketService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('upload')
  @UseInterceptors(FileInterceptor('attachment'))
  async uploadAttachment(
    @Req() req,
    @UploadedFile() attachment: Express.Multer.File,
    @Body() { ticketId, description, isPublic }: CreateAttachmentInput
  ) {
    const user = req.user;
    const [isAdminOrAgent, _] = await this.ticketService.checkTicketAccess(
      user.id,
      parseInt(ticketId)
    );

    // Max allowed file size in bytes.
    const maxFileSize = 2 * 1000000;
    if (attachment.size > maxFileSize) {
      throw new BadRequestException('File size cannot be greater than 2 MB.');
    }
    let mode = 'Public';
    if (isAdminOrAgent && isPublic === false) mode = 'Private';
    let newAttachment: any;
    const sharepointFileName = `${user.rcno}_${moment().unix()}${extname(
      attachment.originalname
    )}`;
    try {
      newAttachment = await this.prisma.ticketAttachment.create({
        data: {
          userId: user.id,
          ticketId: parseInt(ticketId),
          description,
          mode,
          originalName: attachment.originalname,
          mimeType: attachment.mimetype,
          sharepointFileName,
        },
      });
      try {
        await this.attachmentService.uploadFile(attachment, {
          name: sharepointFileName,
        });
        const body = `attachment:${newAttachment.id}`;
        await this.ticketService.createComment(
          user,
          parseInt(ticketId),
          body,
          'Action'
        );
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

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async viewAttachment(@Req() req, @Param() params, @Res() res) {
    const user = req.user;
    const attachmentId = parseInt(params.id);
    const attachment = await this.prisma.ticketAttachment.findFirst({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new BadRequestException('Attachment does not exist.');
    }
    await this.ticketService.checkTicketAccess(user.id, attachment.ticketId);
    const file = await this.attachmentService.getFile(
      attachment.sharepointFileName
    );
    const fileData = file.data;
    res.set({
      'Content-Disposition': `inline; filename=${
        attachment.originalName ?? attachment.sharepointFileName
      }`,
      'Content-Type': attachment.mimeType ?? null,
    });
    res.end(fileData);
  }
}
