import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AttachmentError,
  MAX_ATTACHMENT_BYTES,
  addAttachment,
  isAttachmentStorageConfigured,
  listAttachments,
} from "../../../../lib/attachments";
import { SESSION_COOKIE, verifySessionToken } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
// Multipart framing around the file itself; the file is checked separately.
const REQUEST_OVERHEAD_BYTES = 64 * 1024;
/** @type {Record<string, number>} */
const ATTACHMENT_ERROR_STATUS = {
  too_large: 413,
  unsupported_type: 415,
  too_many: 409,
  empty: 400,
};

/** @param {unknown} body @param {number} status */
function json(body, status) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

async function requireSession() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function GET() {
  if (!(await requireSession())) {
    return json({ error: "Your session expired. Sign in again." }, 401);
  }
  if (!isAttachmentStorageConfigured()) {
    return json({ error: "Notes storage is unavailable." }, 503);
  }

  try {
    return json({ attachments: await listAttachments() }, 200);
  } catch {
    return json({ error: "Attachments could not be loaded." }, 500);
  }
}

/** @param {Request} request */
export async function POST(request) {
  if (!(await requireSession())) {
    return json({ error: "Your session expired. Sign in again." }, 401);
  }
  if (!isAttachmentStorageConfigured()) {
    return json({ error: "Notes storage is unavailable." }, 503);
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_ATTACHMENT_BYTES + REQUEST_OVERHEAD_BYTES
  ) {
    return json({ error: "The file is too large." }, 413);
  }

  /** @type {FormData} */
  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "The upload could not be read." }, 400);
  }

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return json({ error: "Choose a file to attach." }, 400);
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return json({ error: "The file is too large." }, 413);
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const attachments = await addAttachment({ name: file.name, bytes });
    return json({ attachments }, 201);
  } catch (error) {
    if (error instanceof AttachmentError) {
      return json(
        { error: error.message },
        ATTACHMENT_ERROR_STATUS[error.code] || 400,
      );
    }
    return json({ error: "The file could not be attached." }, 500);
  }
}
