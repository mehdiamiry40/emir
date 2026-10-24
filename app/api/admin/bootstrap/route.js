import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isAttachmentStorageConfigured,
  listAttachments,
} from "../../../../lib/attachments";
import { isNotesConfigured, loadNote } from "../../../../lib/notes";
import { isPasskeyConfigured, listPasskeys } from "../../../../lib/passkeys";
import { SESSION_COOKIE, verifySessionToken } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json(
      { error: "Your session expired. Sign in again." },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  /** @type {{ content: string, updatedAt: string | null }} */
  let note = { content: "", updatedAt: null };
  let storageAvailable = isNotesConfigured();
  if (storageAvailable) {
    try {
      note = await loadNote();
    } catch {
      storageAvailable = false;
    }
  }

  /** @type {import("../../../../lib/attachments").AttachmentMetadata[]} */
  let attachments = [];
  let attachmentsAvailable = storageAvailable && isAttachmentStorageConfigured();
  if (attachmentsAvailable) {
    try {
      attachments = await listAttachments();
    } catch {
      attachmentsAvailable = false;
    }
  }

  let passkeyAvailable = isPasskeyConfigured();
  /** @type {Awaited<ReturnType<typeof listPasskeys>>} */
  let passkeys = [];
  if (passkeyAvailable) {
    try {
      passkeys = await listPasskeys();
    } catch {
      passkeyAvailable = false;
    }
  }

  return NextResponse.json(
    {
      note,
      storageAvailable,
      attachments,
      attachmentsAvailable,
      passkeys,
      passkeyAvailable,
    },
    { headers: NO_STORE_HEADERS },
  );
}
