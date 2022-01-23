import { Injectable } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisCacheService {
  constructor() {}
  async connect(): Promise<RedisClientType<any>> {
    const client = createClient();
    client.on('error', (err) => console.log('Redis Client Error', err));
    await client.connect();
    return client;
  }

  parseWithDate(jsonString: string): any {
    var reDateDetect = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/; // startswith: 2015-04-29T22:06:55
    var resultObject = JSON.parse(jsonString, (key: any, value: any) => {
      if (typeof value == 'string' && reDateDetect.exec(value)) {
        return new Date(value);
      }
      return value;
    });
    return resultObject;
  }

  async get(key): Promise<any> {
    const client = await this.connect();
    const valueJSON = await client.get(`helpdesk:${key}`);
    const value = this.parseWithDate(valueJSON);
    console.log(`CACHE\t${key}: ${value}`);
    client.quit();
    return value;
  }

  async set(key, value, ttl) {
    const client = await this.connect();
    const valueJSON = JSON.stringify(value);
    await client.set(`helpdesk:${key}`, valueJSON, { EX: ttl });
    client.quit();
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
    const client = await this.connect();
    const keysWithPrefix = await client.keys('helpdesk:*');
    client.quit();
    return keysWithPrefix.map((k) => k.split('helpdesk:')[1]);
  }

  async del(key) {
    const client = await this.connect();
    await client.del(`helpdesk:${key}`);
    client.quit();
  }

  async deleteAll() {
    const keys = await this.getKeys();
    keys.forEach(async (key) => {
      await this.del(key);
    });
    console.log('Redis cache flushed.');
  }
}
