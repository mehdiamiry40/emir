import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isAttachmentStorageConfigured,
  loadAttachment,
  removeAttachment,
} from "../../../../../lib/attachments";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "../../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

/** @param {unknown} body @param {number} status */
function json(body, status) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

async function requireSession() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Everything stored here is safe to render, and the response is sandboxed to
 * an opaque origin, so files preview in place instead of downloading. Names
 * are already stripped of controls and separators; the ASCII fallback keeps
 * the header well-formed for clients that ignore the RFC 5987 form.
 *
 * @param {string} name
 */
function contentDisposition(name) {
  const fallback = name.replace(/[^A-Za-z0-9._ -]/g, "_");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * @param {Request} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function GET(request, context) {
  if (!(await requireSession())) {
    return json({ error: "Your session expired. Sign in again." }, 401);
  }
  if (!isAttachmentStorageConfigured()) {
    return json({ error: "Notes storage is unavailable." }, 503);
  }

  const { id } = await context.params;

  try {
    const attachment = await loadAttachment(id);
    if (!attachment) {
      return json({ error: "Attachment not found." }, 404);
    }

    const { metadata, bytes } = attachment;
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": metadata.type,
        "Content-Length": String(bytes.length),
        "Content-Disposition": contentDisposition(metadata.name),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch {
    return json({ error: "Attachment could not be read." }, 500);
  }
}

/**
 * @param {Request} request
 * @param {{ params: Promise<{ id: string }> }} context
 */
export async function DELETE(request, context) {
  if (!(await requireSession())) {
    return json({ error: "Your session expired. Sign in again." }, 401);
  }
  if (!isAttachmentStorageConfigured()) {
    return json({ error: "Notes storage is unavailable." }, 503);
  }

  const { id } = await context.params;

  try {
    const attachments = await removeAttachment(id);
    if (!attachments) {
      return json({ error: "Attachment not found." }, 404);
    }
    return json({ attachments }, 200);
  } catch {
    return json({ error: "The attachment could not be removed." }, 500);
  }
}
