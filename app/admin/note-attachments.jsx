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
 *   types: Record<string, { extension: string, label: string, inline: boolean }>,
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
  const inputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
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
    if (!files?.length || !storageAvailable) return;
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
    error || busy || `${attachments.length} of ${maxAttachments} attached`;

  return (
    <section className="notesAttachments" aria-label="Attachments">
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
                  {kind?.inline ? (
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
