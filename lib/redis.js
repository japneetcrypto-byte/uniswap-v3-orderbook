import { Redis } from '@upstash/redis';

// ✅ VERCEL FIX: Use Upstash only (serverless-compatible)
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

export async function getCache(key) {
  if (!redis) {
    console.warn('⚠️  Redis not configured');
    return null;
  }
  
  try {
    const start = Date.now();
    const data = await redis.get(key);
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
  if (!redis) return;
  
  try {
    const start = Date.now();
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttl, serialized);
    const duration = Date.now() - start;
    console.log(`✅ Cache SET: ${key} (TTL: ${ttl}s, ${duration}ms)`);
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

export { redis };
