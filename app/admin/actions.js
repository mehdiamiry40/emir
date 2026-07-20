"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "../../lib/session";
import {
  MAX_NOTE_LENGTH,
  isNotesConfigured,
  saveNote,
} from "../../lib/notes";

/**
 * @param {unknown} content
 * @returns {Promise<
 *   | { ok: true }
 *   | { ok: false, error: string }
 * >}
 */
export async function saveNoteAction(content) {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    return { ok: false, error: "Your session expired. Sign in again." };
  }
  if (!isNotesConfigured()) {
    return { ok: false, error: "Notes storage is unavailable." };
  }

  try {
    await saveNote(content);
    return { ok: true };
  } catch (error) {
    if (error instanceof RangeError) {
      return {
        ok: false,
        error: `Notes cannot exceed ${MAX_NOTE_LENGTH.toLocaleString("en-AU")} characters.`,
      };
    }
    return { ok: false, error: "Notes could not be saved. Try again." };
  }
}
