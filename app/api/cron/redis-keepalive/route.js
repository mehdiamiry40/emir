import { handleRedisKeepaliveRequest } from "../../../../lib/redis-keepalive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** @param {Request} request */
export function GET(request) {
  return handleRedisKeepaliveRequest(request);
}
