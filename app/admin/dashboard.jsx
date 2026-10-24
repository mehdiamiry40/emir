"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SITE_NAME } from "../site";
import { signOut } from "../signin/actions";
import NoteAttachments from "./note-attachments";
import NotesEditor from "./notes-editor";
import PasskeyManager from "./passkey-manager";

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   type: string,
 *   size: number,
 *   addedAt: string,
 * }} DashboardAttachment
 * @typedef {{
 *   id: string,
 *   label: string,
 *   transports: string[],
 *   deviceType: string,
 *   backedUp: boolean,
 *   createdAt: string,
 *   lastUsedAt: string | null,
 * }} DashboardPasskey
 * @typedef {{
 *   note: { content: string, updatedAt: string | null },
 *   storageAvailable: boolean,
 *   attachments: DashboardAttachment[],
 *   attachmentsAvailable: boolean,
 *   passkeys: DashboardPasskey[],
 *   passkeyAvailable: boolean,
 * }} AdminState
 */

/**
 * The private page is prerendered so its inline scripts have stable hashes.
 * Notes, files, and passkeys are loaded after sign-in and never enter that HTML.
 *
 * @param {{
 *   maxLength: number,
 *   accept: string[],
 *   types: Record<string, { extension: string, label: string, thumbnail: boolean }>,
 *   maxAttachments: number,
 *   maxBytes: number,
 * }} props
 */
export default function AdminDashboard({
  maxLength,
  accept,
  types,
  maxAttachments,
  maxBytes,
}) {
  const [state, setState] = useState(/** @type {AdminState | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/bootstrap", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          window.location.assign("/signin");
          return;
        }
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(
            body && typeof body.error === "string"
              ? body.error
              : "Notes could not be loaded.",
          );
          return;
        }
        setState(/** @type {AdminState} */ (body));
      })
      .catch((fetchError) => {
        if (fetchError && typeof fetchError === "object" && "name" in fetchError && fetchError.name === "AbortError") {
          return;
        }
        setError("Notes could not be loaded.");
      });
    return () => controller.abort();
  }, []);

  if (!state) {
    return (
      <main className="notesPage" aria-busy="true" aria-labelledby="notes-title">
        <h1 className="notesTitle" id="notes-title">
          Notes
        </h1>
        {error ? (
          <p className="notesStatus" role="alert">
            {error}
          </p>
        ) : null}
      </main>
    );
  }

  return (
    <main className="notesPage" aria-labelledby="notes-title">
      <header className="notesHeader">
        <div className="notesIdentity">
          <span className="notesEyebrow">{SITE_NAME}</span>
          <h1 className="notesTitle" id="notes-title">
            Notes
          </h1>
        </div>
        <nav className="notesActions" aria-label="Notes navigation">
          <PasskeyManager
            initialPasskeys={state.passkeys}
            available={state.passkeyAvailable}
          />
          <Link className="notesHomeLink" href="/">
            Home
          </Link>
          <form action={signOut}>
            <button className="adminSignout" type="submit">
              Sign out
            </button>
          </form>
        </nav>
      </header>
      <NotesEditor
        initialContent={state.note.content}
        initialUpdatedAt={state.note.updatedAt}
        maxLength={maxLength}
        storageAvailable={state.storageAvailable}
      >
        <NoteAttachments
          initialAttachments={state.attachments}
          accept={accept}
          types={types}
          maxAttachments={maxAttachments}
          maxBytes={maxBytes}
          storageAvailable={state.attachmentsAvailable}
        />
      </NotesEditor>
    </main>
  );
}
