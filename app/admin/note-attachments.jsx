"use client";

import { useEffect, useRef, useState } from "react";

const ENDPOINT = "/api/notes/attachments";

/** @param {number} bytes */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {{
 *   initialAttachments: import("../../lib/attachments").AttachmentMetadata[],
 *   accept: string[],
 *   types: Record<string, { extension: string, label: string, thumbnail: boolean }>,
 *   maxAttachments: number,
 *   maxBytes: number,
 *   storageAvailable: boolean,
 * }} props
 */
export default function NoteAttachments({
  initialAttachments,
  accept,
  types,
  maxAttachments,
  maxBytes,
  storageAvailable,
}) {
  const [attachments, setAttachments] = useState(initialAttachments);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [busy, setBusy] = useState(/** @type {string | null} */ (null));
  const [dropping, setDropping] = useState(false);
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const uploadRef = useRef(/** @type {(files: FileList | null) => void} */ (
    () => {}
  ));
  const isFull = attachments.length >= maxAttachments;

  // Picks up files attached from another device, and keeps the tray correct
  // in development, where storage falls back to memory per server bundle.
  useEffect(() => {
    if (!storageAvailable) return undefined;
    const controller = new AbortController();

    fetch(ENDPOINT, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (Array.isArray(result?.attachments)) setAttachments(result.attachments);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [storageAvailable]);

  /** @param {Response} response */
  async function readError(response) {
    try {
      const body = await response.json();
      if (body && typeof body.error === "string") return body.error;
    } catch {}
    return "The file could not be attached.";
  }

  /** @param {FileList | null} files */
  async function upload(files) {
    if (!files?.length || !storageAvailable || busy) return;
    setError(null);

    for (const file of Array.from(files)) {
      if (file.size > maxBytes) {
        setError(`${file.name} is larger than ${formatSize(maxBytes)}.`);
        continue;
      }

      setBusy(`Attaching ${file.name}...`);
      const body = new FormData();
      body.append("file", file);

      try {
        const response = await fetch(ENDPOINT, { method: "POST", body });
        if (!response.ok) {
          setError(await readError(response));
          continue;
        }
        const result = await response.json();
        setAttachments(result.attachments);
      } catch {
        setError("The file could not be attached.");
      } finally {
        setBusy(null);
      }
    }
  }

  uploadRef.current = upload;

  // Dropping a file anywhere on the page, or pasting a screenshot, attaches
  // it. Both are ignored while an upload is in flight so two writes to the
  // attachment index cannot interleave.
  useEffect(() => {
    if (!storageAvailable) return undefined;

    /** @param {DragEvent} event */
    const carriesFiles = (event) =>
      Array.from(event.dataTransfer?.types || []).includes("Files");

    /** @param {DragEvent} event */
    const onDragOver = (event) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDropping(true);
    };
    /** @param {DragEvent} event */
    const onDragLeave = (event) => {
      if (event.relatedTarget) return;
      setDropping(false);
    };
    /** @param {DragEvent} event */
    const onDrop = (event) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDropping(false);
      uploadRef.current(event.dataTransfer?.files || null);
    };
    /** @param {ClipboardEvent} event */
    const onPaste = (event) => {
      const data = event.clipboardData;
      const files = data?.files;
      if (!data || !files?.length) return;
      const text = data.getData("text/plain");
      if (
        text &&
        event.target instanceof HTMLElement &&
        event.target.closest("textarea, input")
      ) {
        return;
      }
      event.preventDefault();
      uploadRef.current(files);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [storageAvailable]);

  /** @param {{ id: string, name: string }} attachment */
  async function remove(attachment) {
    if (!storageAvailable) return;
    setError(null);
    setBusy(`Removing ${attachment.name}...`);

    try {
      const response = await fetch(`${ENDPOINT}/${attachment.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const result = await response.json();
      setAttachments(result.attachments);
    } catch {
      setError("The attachment could not be removed.");
    } finally {
      setBusy(null);
    }
  }

  const status =
    error ||
    busy ||
    (dropping && !isFull ? "Drop to attach" : null) ||
    `${attachments.length} of ${maxAttachments} attached`;

  return (
    <section
      className={`notesAttachments${dropping && !isFull ? " notesAttachmentsDropping" : ""}`}
      aria-label="Attachments"
    >
      {attachments.length > 0 && (
        <ul className="notesAttachmentList">
          {attachments.map((attachment) => {
            const kind = types[attachment.type];
            return (
              <li className="notesAttachment" key={attachment.id}>
                <a
                  className="notesAttachmentOpen"
                  href={`${ENDPOINT}/${attachment.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {kind?.thumbnail ? (
                    <img
                      className="notesAttachmentThumb"
                      src={`${ENDPOINT}/${attachment.id}`}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span className="notesAttachmentKind" aria-hidden="true">
                      {kind?.label || "FILE"}
                    </span>
                  )}
                  <span className="notesAttachmentText">
                    <span className="notesAttachmentName">
                      {attachment.name}
                    </span>
                    <span className="notesAttachmentSize">
                      {formatSize(attachment.size)}
                    </span>
                  </span>
                </a>
                <button
                  className="notesAttachmentRemove"
                  type="button"
                  onClick={() => remove(attachment)}
                  disabled={Boolean(busy) || !storageAvailable}
                  aria-label={`Remove ${attachment.name}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="notesAttachmentBar">
        <button
          className="notesAttachButton"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!storageAvailable || Boolean(busy) || isFull}
        >
          Attach PDF or picture
        </button>
        <span className="notesAttachmentHint">or drop a file, or paste one</span>
        <input
          className="notesFilePicker"
          ref={inputRef}
          type="file"
          multiple
          accept={accept.join(",")}
          onChange={(event) => {
            upload(event.target.files);
            event.target.value = "";
          }}
        />
        <p
          className={`notesAttachmentStatus${error ? " notesStatusError" : ""}`}
          aria-live="polite"
        >
          {status}
        </p>
      </div>
    </section>
  );
}
