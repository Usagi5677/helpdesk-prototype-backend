import { GraphQLModule } from '@nestjs/graphql';
import { Module, UnauthorizedException } from '@nestjs/common';
import { AppController } from './controllers/app.controller';
import { AppService } from './services/app.service';
import { AuthModule } from './resolvers/auth/auth.module';
import { UserModule } from './resolvers/user/user.module';
import { AppResolver } from './resolvers/app.resolver';
import { DateScalar } from './common/scalars/date.scalar';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from './configs/config';
import { GraphqlConfig } from './configs/config.interface';
import { PrismaModule } from 'nestjs-prisma';
import { TicketModule } from './resolvers/ticket/ticket.module';
import { AttachmentModule } from './resolvers/attachment/attachment.module';
import { BullModule } from '@nestjs/bull';
import { KnowledgebaseModule } from './resolvers/knowledgebase/knowledgebase.module';
import jwtDecode from 'jwt-decode';
import { PubsubModule } from './resolvers/pubsub/pubsub.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SiteModule } from './resolvers/site/site.module';
import { APSModule } from './services/aps.module';
import { isRenderEnvironment } from './common/helpers/env.util';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    GraphQLModule.forRootAsync({
      useFactory: async (configService: ConfigService) => {
        const graphqlConfig = configService.get<GraphqlConfig>('graphql');
        return {
          installSubscriptionHandlers: true,
          buildSchemaOptions: {
            numberScalarMode: 'integer',
          },
          sortSchema: graphqlConfig.sortSchema,
          autoSchemaFile:
            graphqlConfig.schemaDestination || './src/schema.graphql',
          debug: graphqlConfig.debug,
          playground: graphqlConfig.playgroundEnabled,
          context: ({ req }) => ({ req }),
          subscriptions: {
            'subscriptions-transport-ws': {
              onConnect: (connectionParams: { authToken: any }) => {
                const authHeader = connectionParams.authToken;
                if (!authHeader) throw new UnauthorizedException();
                const token = authHeader.split('Bearer ')[1];
                if (!token) throw new UnauthorizedException();
                const decoded = jwtDecode(token);
                if (!decoded) throw new UnauthorizedException();
                return decoded;
              },
            },
          },
        };
      },
      inject: [ConfigService],
    }),
    PrismaModule.forRoot({
      isGlobal: true,
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isOnRender = isRenderEnvironment();

        if (isOnRender && process.env.REDIS_URL) {
          try {
            const url = new URL(process.env.REDIS_URL);
            console.log(`Using Render Redis for Bull at: ${url.hostname}`);

            return {
              redis: {
                host: url.hostname,
                port: parseInt(url.port, 10) || 6379,
              },
            };
          } catch (error) {
            console.error('Failed to parse Redis URL:', error);
          }
        }

        // Local development fallback
        console.log('Using local Redis for Bull');
        return {
          redis: {
            host: 'localhost',
            port: 6379,
          },
        };
      },
      inject: [ConfigService],
    }),
    PubsubModule,
    AuthModule,
    UserModule,
    TicketModule,
    AttachmentModule,
    KnowledgebaseModule,
    ScheduleModule.forRoot(),
    SiteModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppResolver, DateScalar],
})
export class AppModule {}
