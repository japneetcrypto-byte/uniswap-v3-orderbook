const redis = require('redis');

// Local Redis (no signup needed)
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000)
  }
});

client.on('error', (err) => console.log('Redis Error:', err));
client.on('connect', () => console.log('✅ Redis connected'));

// Connect immediately
(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error('Redis connection failed:', err);
  }
})();

// Cache wrapper
async function getCache(key) {
  try {
    if (!client.isOpen) return null;
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

async function setCache(key, value, ttlSeconds = 60) {
  try {
    if (!client.isOpen) return;
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

module.exports = { getCache, setCache };
