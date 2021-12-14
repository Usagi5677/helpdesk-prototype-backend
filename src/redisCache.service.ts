import { Injectable, Inject, CACHE_MANAGER } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get(key) {
    return await this.cache.get(key);
  }

  async set(key, value, ttl?) {
    await this.cache.set(key, value, { ttl });
  }

  async del(key) {
    await this.cache.del(key);
  }

  async deleteAll() {
    const keys = await this.cache.keys();
    keys.forEach(async (key) => {
      await this.del(key);
    });
    console.log('Redis cache flushed.');
  }

  async getKeys() {
    const keys = await this.cache.keys();
    return keys;
  }
}
