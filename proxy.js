import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session.js";

/**
 * /admin is a static shell so its inline scripts can be hashed. This proxy is
 * what still turns a missing or revoked session into the 307 the private page
 * has always returned. It does not run for the public pages, which stay
 * CDN-cacheable.
 *
 * @param {import("next/server").NextRequest} request
 */
export async function proxy(request) {
  // Server actions POST back to this route. They check the session themselves,
  // including sign-out after a passkey was removed and the cookie is no longer valid.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, { external: true })) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/signin";
  url.search = "";
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
