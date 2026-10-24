import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_URL } from "./app/site.js";
import { buildContentSecurityPolicy, buildDevContentSecurityPolicy } from "./lib/csp-policy.mjs";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV === "development";
// Production script hashes are unknown until prerender finishes. The placeholder is
// replaced in the build output by scripts/csp-hashes.mjs. On Vercel that is too late
// for the header the CDN serves: the Next adapter copies it into `.next/output/config.json`
// during onBuildComplete, while `next build` is still running. scripts/csp-adapter.mjs
// wraps that adapter and writes the hashes first. Development cannot use those hashes.
const contentSecurityPolicy = isDevelopment
  ? buildDevContentSecurityPolicy()
  : buildContentSecurityPolicy([]);

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Vercel sets NEXT_ADAPTER_PATH to its own adapter. Wrap it so the routing
  // object it serialises already contains the real script hashes.
  ...(process.env.NEXT_ADAPTER_PATH
    ? { adapterPath: path.join(projectRoot, "scripts/csp-adapter.mjs") }
    : {}),
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), publickey-credentials-get=(self), publickey-credentials-create=(self)",
          },
          ...(isDevelopment
            ? []
            : [
                {
                  key: "Access-Control-Allow-Origin",
                  value: new URL(SITE_URL).origin,
                },
              ]),
        ],
      },
      {
        // Stored files are inert: no scripts, no subresources, no navigation.
        source: "/api/notes/attachments/:id",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; sandbox",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
