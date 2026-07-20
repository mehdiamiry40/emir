"use client";

import { useEffect, useState, useTransition } from "react";
import { saveNoteAction } from "./actions";

/**
 * @param {{
 *   initialContent: string,
 *   initialUpdatedAt: string | null,
 *   maxLength: number,
 *   storageAvailable: boolean,
 * }} props
 */
export default function NotesEditor({
  initialContent,
  initialUpdatedAt,
  maxLength,
  storageAvailable,
}) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [hasSaved, setHasSaved] = useState(Boolean(initialUpdatedAt));
  const [error, setError] = useState(
    storageAvailable ? null : "Notes storage is unavailable.",
  );
  const [isPending, startTransition] = useTransition();
  const isDirty = content !== savedContent;

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeLeaving = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [isDirty]);

  function save() {
    if (!storageAvailable || isPending || !isDirty) return;
    const contentToSave = content;
    setError(null);

    startTransition(async () => {
      const result = await saveNoteAction(contentToSave);
      if (result.ok) {
        setSavedContent(contentToSave);
        setHasSaved(true);
      } else {
        setError(result.error);
      }
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    save();
  }

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  }

  const status = isPending
    ? "Saving..."
    : error
      ? error
      : isDirty
        ? "Unsaved"
        : hasSaved
          ? "Saved"
          : "Ready";

  return (
    <form className="notesWorkspace" onSubmit={handleSubmit}>
      <textarea
        className="notesEditor"
        aria-label="Notes"
        name="content"
        value={content}
        maxLength={maxLength}
        placeholder="Notes"
        disabled={!storageAvailable}
        onChange={(event) => {
          setContent(event.target.value);
          setError(null);
        }}
        onKeyDown={handleKeyDown}
      />
      <footer className="notesFooter">
        <p
          className={`notesStatus${error ? " notesStatusError" : ""}`}
          aria-live="polite"
        >
          {status}
        </p>
        <span className="notesCount">
          {content.length.toLocaleString("en-AU")} /{" "}
          {maxLength.toLocaleString("en-AU")}
        </span>
        <button
          className="notesSave"
          type="submit"
          disabled={!storageAvailable || isPending || !isDirty}
        >
          {isPending ? "Saving" : "Save"}
        </button>
      </footer>
    </form>
  );
}
