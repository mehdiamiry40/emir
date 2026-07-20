import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "../../lib/session";
import {
  MAX_NOTE_LENGTH,
  isNotesConfigured,
  loadNote,
} from "../../lib/notes";
import { SITE_NAME } from "../site";
import { signOut } from "../signin/actions";
import NotesEditor from "./notes-editor";

export const metadata = {
  title: `${SITE_NAME} — Admin`,
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    redirect("/signin");
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
        initialContent={note.content}
        initialUpdatedAt={note.updatedAt}
        maxLength={MAX_NOTE_LENGTH}
        storageAvailable={storageAvailable}
      />
    </main>
  );
}
