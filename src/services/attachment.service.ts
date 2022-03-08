import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as http from 'http2';
import { extname } from 'path';
import * as qs from 'qs';
import { lastValueFrom, map } from 'rxjs';
import { TicketAttachment } from 'src/models/ticket-attachment.model';
import { User } from 'src/models/user.model';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisCacheService } from 'src/redisCache.service';
import { TicketService } from './ticket.service';

interface FileOptions {
  path?: string;
  name?: string;
}

@Injectable()
export class AttachmentService {
  private readonly logger = new Logger(AttachmentService.name);
  private readonly siteUrl = `https://${process.env.SP_URL}/sites/${process.env.SP_SITE_NAME}`;
  private readonly serverRelativeUrlToFolder = 'Shared Documents/Test';
  private readonly SP_TOKEN_KEY = 'SHAREPOINT_ACCESS_TOKEN';

  constructor(
    private prisma: PrismaService,
    private readonly redisCacheService: RedisCacheService,
    private readonly httpService: HttpService,
    private readonly ticketService: TicketService
  ) {}

  getInfo(document: Express.Multer.File) {
    return {
      ext: extname(document.originalname),
      size: document.size,
    };
  }

  // Ex: if /path/to/file.text => ['/path/to', 'file.txt']
  // returns [path, file]
  getFileNameAndPath(filePath: string) {
    const splitPath = filePath.split('/');
    return [
      splitPath.slice(0, splitPath.length - 1).join('/'),
      ...splitPath.slice(-1),
    ];
  }

  async getSharePointAccessToken(): Promise<string> {
    const spToken: string = await this.redisCacheService.get(this.SP_TOKEN_KEY);

    if (spToken) {
      return spToken;
    }

    const url = `https://accounts.accesscontrol.windows.net/${process.env.SP_TENANT_ID}/tokens/OAuth/2`;
    const CLIENT_ID = `${process.env.SP_CLIENT_ID}@${process.env.SP_TENANT_ID}`;
    const CLIENT_SECRET = `${process.env.SP_CLIENT_SECRET}`;
    const RESOURCE = `${process.env.SP_PRINCIPAL_ID}/${process.env.SP_URL}@${process.env.SP_TENANT_ID}`;
    const data = qs.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      resource: RESOURCE,
    });
    try {
      const result = await lastValueFrom(
        this.httpService
          .post(url, data, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          })
          .pipe(map((resp) => resp.data))
      );
      await this.redisCacheService.set(
        this.SP_TOKEN_KEY,
        result.access_token,
        result.expires_in
      );

      return result.access_token;
    } catch (e) {
      throw new InternalServerErrorException(e.message);
    }
  }

  async getFile(filePath: string) {
    const token = await this.getSharePointAccessToken();
    const [path, fileName] = this.getFileNameAndPath(filePath);
    const url = `${this.siteUrl}/_api/web/getFolderByServerRelativeUrl('${this.serverRelativeUrlToFolder}${path}')/Files('${fileName}')/$value`;
    try {
      http;
      return await lastValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'arraybuffer',
        })
      );
    } catch (e) {
      throw new NotFoundException('File not found');
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    { name, path = '' }: FileOptions
  ) {
    const fileNameWithExtension = name;
    this.logger.debug(
      `${new Date().toLocaleTimeString()} - Upload of file ${fileNameWithExtension} (${(
        file.size /
        1024 /
        1024
      ).toFixed(2)} MB) started...`
    );

    const url = `${this.siteUrl}/_api/web/getFolderByServerRelativeUrl('${this.serverRelativeUrlToFolder}${path}')/files/add(overwrite=true, url='${fileNameWithExtension}')`;
    const token = await this.getSharePointAccessToken();
    try {
      const result = await lastValueFrom(
        this.httpService
          .post(url, file.buffer, {
            headers: {
              Accept: 'application/json;odata=verbose',
              'Content-Length': `${file.size}`,
              Authorization: `Bearer ${token}`,
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          })
          .pipe(map((resp) => resp.data))
      );
      if (result.error) {
        if (
          result.error.code ===
          '-2147024893, System.IO.DirectoryNotFoundException'
        ) {
          throw new NotFoundException('Folder not found');
        } else {
          this.logger.error('Result error', result.error);
          throw new InternalServerErrorException(
            'An error occurred uploading file'
          );
        }
      }
      this.logger.debug(
        `${new Date().toLocaleTimeString()} - Upload of file ${fileNameWithExtension} completed!`
      );
      return result;
    } catch (e) {
      this.logger.error('Thrown Error', e.response.data.error);
      throw new InternalServerErrorException(
        'An error occurred uploading file'
      );
    }
  }

  async deleteFile(fileName: string, path: string) {
    const token = await this.getSharePointAccessToken();
    const url = `${this.siteUrl}/_api/web/getFolderByServerRelativeUrl('${
      this.serverRelativeUrlToFolder
    }${path}${fileName
      .replace(new RegExp('/', 'g'), '_')
      .replace(new RegExp("'", 'g'), '')}')`;
    try {
      await lastValueFrom(
        this.httpService.post(url, undefined, {
          headers: {
            Accept: 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-HTTP-Method': 'DELETE',
            'If-Match': '*',
            Authorization: `Bearer ${token}`,
          },
        })
      );
    } catch (e) {
      throw new NotFoundException('File not found');
    }
  }

  async ticketAttachments(
    user: User,
    ticketId: number
  ): Promise<TicketAttachment[]> {
    const [isAdminOrAgent] = await this.ticketService.checkTicketAccess(
      user.id,
      ticketId
    );
    const attachments = await this.prisma.ticketAttachment.findMany({
      where: { ticketId, mode: isAdminOrAgent ? undefined : 'Public' },
      include: { user: true },
    });
    console.log(attachments);
    return attachments;
  }
}
