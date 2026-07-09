"use client";

import { useId, useState } from "react";

/** @typedef {{ kind: "ok" | "err", text: string }} SaveStatus */

/** @param {string} iso */
function previewLabel(iso) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return "—";
  }
}

/**
 * @param {object} props
 * @param {{ iso: string, label: string }} props.initialDate
 * @param {boolean} props.storageConfigured
 */
export default function AdminPanel({ initialDate, storageConfigured }) {
  const [iso, setIso] = useState(initialDate.iso);
  const [status, setStatus] = useState(/** @type {SaveStatus | null} */ (null));
  const [saving, setSaving] = useState(false);
  const dateId = useId();

  const save = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iso }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus({
          kind: "ok",
          text: `Saved. The site now shows ${data.date?.label ?? iso}.`,
        });
      } else {
        setStatus({ kind: "err", text: data.error || "Failed to save." });
      }
    } catch {
      setStatus({ kind: "err", text: "Network error — nothing was saved." });
    }
    setSaving(false);
  };

  return (
    <div className="signinForm">
      <label className="signinField" htmlFor={dateId}>
        <span>Site date</span>
        <input
          id={dateId}
          type="date"
          value={iso}
          onChange={(e) => setIso(e.target.value)}
        />
      </label>
      <p className="adminPreview" aria-live="polite">
        {previewLabel(iso)}
      </p>
      <button
        className="signinSubmit"
        type="button"
        onClick={save}
        disabled={saving || !storageConfigured || !iso}
      >
        {saving ? "Saving…" : "Save date"}
      </button>
      {!storageConfigured ? (
        <p className="signinStatus">
          Date saving is disabled. The public date comes from app/site.js unless
          ENABLE_DATE_OVERRIDE and Vercel Edge Config are configured.
        </p>
      ) : null}
      {status ? (
        <p className="signinStatus" role={status.kind === "err" ? "alert" : "status"}>
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
