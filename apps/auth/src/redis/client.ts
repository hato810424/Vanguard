import { Redis } from "ioredis";

const SESSION_KEY_PREFIX = "auth:sess:";

let client: Redis | undefined;

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (!client) {
    client = new Redis(url, { maxRetriesPerRequest: 3 });
  }
  return client;
}

export function sessionCacheKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`;
}
