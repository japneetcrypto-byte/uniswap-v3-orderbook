import { Redis } from '@upstash/redis';

// Production: Use Upstash Redis (serverless-friendly)
// Development: Use local Redis
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Fallback for local development (if Upstash not configured)
let localRedis = null;
if (!redis && typeof window === 'undefined') {
  try {
    const { Redis: IORedis } = require('ioredis');
    localRedis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
    localRedis.on('connect', () => console.log('✅ Local Redis connected'));
    localRedis.on('error', (err) => console.error('❌ Redis error:', err));
  } catch (error) {
    console.warn('⚠️  Redis not available, caching disabled');
  }
}

const activeRedis = redis || localRedis;

export async function getCache(key) {
  if (!activeRedis) return null;
  
  try {
    const start = Date.now();
    const data = await activeRedis.get(key);
    const duration = Date.now() - start;
    
    if (data) {
      console.log(`💾 Cache HIT: ${key} (${duration}ms)`);
      return typeof data === 'string' ? JSON.parse(data) : data;
    }
    
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

export async function setCache(key, value, ttl = 60) {
  if (!activeRedis) return;
  
  try {
    const start = Date.now();
    const serialized = JSON.stringify(value);
    await activeRedis.setex(key, ttl, serialized);
    const duration = Date.now() - start;
    console.log(`✅ Cache SET: ${key} (TTL: ${ttl}s, ${duration}ms)`);
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

export { activeRedis as redis };
