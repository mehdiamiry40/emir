import { Redis } from "@upstash/redis";

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env */
export function resolveRedisConfig(env = process.env) {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    };
  }

  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) {
    return {
      url: env.KV_REST_API_URL,
      token: env.KV_REST_API_TOKEN,
    };
  }

  return null;
}

/** @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env */
export function createRedisClient(env = process.env) {
  const config = resolveRedisConfig(env);
  return config ? new Redis(config) : null;
}
