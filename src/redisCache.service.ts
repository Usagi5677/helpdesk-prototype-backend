import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);
  private client: RedisClientType<any>;
  PREFIX = 'helpdesk';

  async onModuleInit() {
    // Connect once when the module initializes
    await this.initClient();
    this.logger.log('Redis cache service initialized');
  }

  async onModuleDestroy() {
    // Close connection when the app shuts down
    if (this.client) {
      await this.client.quit();
      this.logger.log('Redis connection closed');
    }
  }

  async initClient() {
    try {
      // Get REDIS_URL from environment
      const redisUrl = process.env.REDIS_URL;

      // Check if we're on Render (Redis URL contains 'red-cv9crr')
      const isRender = redisUrl && redisUrl.includes('red-cv9crr');

      // Use Render Redis URL if we're on Render, otherwise use localhost
      const connectionUrl = isRender ? redisUrl : 'redis://localhost:6379';

      this.logger.log(
        `Connecting to Redis at: ${connectionUrl.replace(
          /redis:\/\/.*@/,
          'redis://***@'
        )}`
      );

      this.client = createClient({
        url: connectionUrl,
      });

      // Add event listeners
      this.client.on('error', (err) => {
        this.logger.error(`Redis Client Error: ${err.message}`, err.stack);
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async getClient(): Promise<RedisClientType<any>> {
    if (!this.client || !this.client.isOpen) {
      await this.initClient();
    }
    return this.client;
  }

  parseWithDate(jsonString: string): any {
    if (!jsonString) return null;

    const reDateDetect = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/; // startswith: 2015-04-29T22:06:55
    try {
      const resultObject = JSON.parse(jsonString, (key: any, value: any) => {
        if (typeof value == 'string' && reDateDetect.exec(value)) {
          return new Date(value);
        }
        return value;
      });
      return resultObject;
    } catch (error) {
      this.logger.error(`Error parsing JSON with date: ${error.message}`);
      return null;
    }
  }

  async get(key): Promise<any> {
    const client = await this.getClient();
    const valueJSON = await client.get(`${this.PREFIX}:${key}`);
    if (!valueJSON) return null;
    return this.parseWithDate(valueJSON);
  }

  async set(key, value, ttl) {
    const client = await this.getClient();
    const valueJSON = JSON.stringify(value);
    await client.set(`${this.PREFIX}:${key}`, valueJSON, { EX: ttl });
  }

  async setFor10Sec(key, value) {
    await this.set(key, value, 10);
  }

  async setForDay(key, value) {
    const secondsInDay = 24 * 60 * 60;
    await this.set(key, value, secondsInDay);
  }

  async setForMonth(key, value) {
    const secondsInMonth = 30 * 24 * 60 * 60;
    await this.set(key, value, secondsInMonth);
  }

  async getKeys() {
    const client = await this.getClient();
    const keysWithPrefix = await client.keys(`${this.PREFIX}:*`);
    return keysWithPrefix.map((k) => k.split(`${this.PREFIX}:`)[1]);
  }

  async getKeysPattern(pattern: string) {
    const client = await this.getClient();
    const keysWithPrefix = await client.keys(`${this.PREFIX}:${pattern}`);
    return keysWithPrefix.map((k) => k.split(`${this.PREFIX}:`)[1]);
  }

  async del(key) {
    const client = await this.getClient();
    await client.del(`${this.PREFIX}:${key}`);
  }

  async delPattern(pattern: string) {
    const keys = await this.getKeysPattern(pattern);
    for (const key of keys) {
      await this.del(key);
    }
  }

  async deleteAll() {
    const keys = await this.getKeys();
    const promises = keys.map((key) => this.del(key));
    await Promise.all(promises);
    this.logger.log('Redis cache flushed.');
  }
}
