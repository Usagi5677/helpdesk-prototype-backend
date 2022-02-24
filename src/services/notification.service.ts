import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import nm, { SendMailOptions, Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { PrismaService } from '../prisma/prisma.service';
import { Nodemailer } from '../resolvers/notification/notification.provider';
import { PubSub } from 'graphql-subscriptions';

export interface Notification {
  userId: number;
  body: string;
}

export const pubSubTwo = new PubSub();
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly transporter: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(
    @Inject(Nodemailer) private nodemailer: typeof nm,
    @InjectQueue('notification') private notificationQueue: Queue,
    private readonly prisma: PrismaService
  ) {
    this.transporter = this.nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
      },
    });
  }

  async create(notification: Notification, emailOptions?: SendMailOptions) {
    const notif = await this.prisma.notification.create({
      data: {
        body: notification.body,
        userId: notification.userId,
      },
    });
    //console.log(notif);
    await pubSubTwo.publish('notificationCreated', {
      notificationCreated: notif,
    });
    const value = pubSubTwo.asyncIterator('notificationCreated');
    console.log(value);
    if (emailOptions) {
      this.sendEmail(emailOptions);
    }
  }

  async sendEmail(options: SendMailOptions) {
    const to = [...((options.to as any[]) ?? [])];

    // Don't send email for now
    return;
    if (to.length > 0) {
      await this.transporter.sendMail({
        ...options,
        from: `"Helpdesk" <no-reply@mtcc.com.mv>`,
        to,
        subject: options.subject ? `Helpdesk: ${options.subject}` : undefined,
      });
    }
  }

  async createInBackground(
    notification: Notification,
    emailOptions?: SendMailOptions
  ) {
    await this.notificationQueue.add('create', { notification, emailOptions });
  }

  async sendEmailInBackground(options: SendMailOptions) {
    await this.notificationQueue.add('sendEmail', { options });
  }
}
