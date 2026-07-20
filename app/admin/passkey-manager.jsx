"use client";

import {
  browserSupportsWebAuthn,
  startRegistration,
} from "@simplewebauthn/browser";
import { useEffect, useRef, useState } from "react";
import { removePasskeyAction } from "./passkey-actions";

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   transports: string[],
 *   deviceType: string,
 *   backedUp: boolean,
 *   createdAt: string,
 *   lastUsedAt: string | null,
 * }} PasskeySummary
 */

/** @param {Response} response */
async function readResponse(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : "Passkey request failed.",
    );
  }
  return body;
}

/** @param {unknown} error @param {string} fallback */
function passkeyErrorMessage(error, fallback) {
  if (error && typeof error === "object" && "name" in error) {
    if (error.name === "NotAllowedError") return "Passkey setup was cancelled.";
    if (error.name === "InvalidStateError") {
      return "This passkey is already registered.";
    }
  }
  return error instanceof Error ? error.message : fallback;
}

/**
 * @param {{ initialPasskeys: PasskeySummary[], available: boolean }} props
 */
export default function PasskeyManager({ initialPasskeys, available }) {
  const dialogRef = useRef(/** @type {HTMLDialogElement | null} */ (null));
  const [passkeys, setPasskeys] = useState(initialPasskeys);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
  }, []);

  function open() {
    setStatus(null);
    dialogRef.current?.showModal();
  }

  function close() {
    if (!busy) dialogRef.current?.close();
  }

  async function add() {
    if (busy) return;
    setBusy(true);
    setStatus("Waiting for your device...");

    try {
      const options = await readResponse(
        await fetch("/api/passkeys/registration/options", {
          method: "POST",
          headers: { Accept: "application/json" },
        }),
      );
      const registration = await startRegistration({ optionsJSON: options });
      const result = await readResponse(
        await fetch("/api/passkeys/registration/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(registration),
        }),
      );
      setPasskeys(result.passkeys);
      setStatus("Passkey added.");
    } catch (error) {
      setStatus(passkeyErrorMessage(error, "Passkey could not be added."));
    } finally {
      setBusy(false);
    }
  }

  /** @param {PasskeySummary} passkey */
  async function remove(passkey) {
    if (busy || !window.confirm(`Remove ${passkey.label}?`)) return;
    setBusy(true);
    setStatus("Removing passkey...");

    try {
      const result = await removePasskeyAction(passkey.id);
      if (!result.ok) throw new Error(result.error);
      setPasskeys(result.passkeys);
      setStatus("Passkey removed.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Passkey could not be removed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canUsePasskeys = available && supported;

  return (
    <>
      <button
        className="adminPasskeys"
        type="button"
        onClick={open}
        disabled={!available}
      >
        Passkeys
      </button>
      <dialog
        className="passkeyDialog"
        ref={dialogRef}
        aria-labelledby="passkey-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <section className="passkeyPanel">
          <header className="passkeyHeader">
            <div>
              <span className="passkeyEyebrow">Security</span>
              <h2 id="passkey-title">Passkeys</h2>
            </div>
            <button
              className="passkeyClose"
              type="button"
              onClick={close}
              disabled={busy}
              aria-label="Close passkeys"
            >
              ×
            </button>
          </header>

          <div className="passkeyList">
            {passkeys.length ? (
              passkeys.map((passkey) => (
                <div className="passkeyItem" key={passkey.id}>
                  <div className="passkeyDetails">
                    <strong>{passkey.label}</strong>
                    <span>
                      {passkey.backedUp ? "Synced" : "Device"} · Added{" "}
                      {new Intl.DateTimeFormat("en-AU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(new Date(passkey.createdAt))}
                    </span>
                  </div>
                  <button
                    className="passkeyRemove"
                    type="button"
                    onClick={() => remove(passkey)}
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="passkeyEmpty">No passkeys</p>
            )}
          </div>

          <footer className="passkeyFooter">
            <p className="passkeyStatus" aria-live="polite">
              {supported ? status : "Passkeys are not supported on this browser."}
            </p>
            <button
              className="passkeyAdd"
              type="button"
              onClick={add}
              disabled={!canUsePasskeys || busy}
            >
              {busy ? "Working..." : "Add passkey"}
            </button>
          </footer>
        </section>
      </dialog>
    </>
  );
}
