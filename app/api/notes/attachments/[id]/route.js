import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ATTACHMENT_TYPES,
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
 * Names are already stripped of controls and separators; the ASCII fallback
 * keeps the header well-formed for clients that ignore the RFC 5987 form.
 *
 * @param {string} name
 * @param {boolean} inline
 */
function contentDisposition(name, inline) {
  const fallback = name.replace(/[^A-Za-z0-9._ -]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
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
    const { inline } = ATTACHMENT_TYPES[metadata.type];
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": metadata.type,
        "Content-Length": String(bytes.length),
        "Content-Disposition": contentDisposition(metadata.name, inline),
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
