"use client";

import {
  browserSupportsWebAuthn,
  startAuthentication,
} from "@simplewebauthn/browser";
import { useActionState, useEffect, useId, useState } from "react";
import { MAX_PASSWORD_LENGTH } from "../../lib/auth-limits";
import { signIn } from "./actions";

const initialState = { error: null };

/** @param {{ passkeyEnabled: boolean }} props */
export default function SignInForm({ passkeyEnabled }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(true);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const [passkeyError, setPasskeyError] = useState(
    /** @type {string | null} */ (null),
  );
  const usernameId = useId();
  const passwordId = useId();

  useEffect(() => {
    setPasskeySupported(browserSupportsWebAuthn());
  }, []);

  async function signInWithPasskey() {
    if (passkeyPending) return;
    setPasskeyPending(true);
    setPasskeyError(null);

    try {
      const optionsResponse = await fetch(
        "/api/passkeys/authentication/options",
        { method: "POST", headers: { Accept: "application/json" } },
      );
      const options = await optionsResponse.json().catch(() => ({}));
      if (!optionsResponse.ok) {
        throw new Error(
          typeof options.error === "string"
            ? options.error
            : "Passkey sign-in failed.",
        );
      }

      const authentication = await startAuthentication({
        optionsJSON: options,
      });
      const verifyResponse = await fetch(
        "/api/passkeys/authentication/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(authentication),
        },
      );
      const result = await verifyResponse.json().catch(() => ({}));
      if (!verifyResponse.ok || !result.verified) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Passkey could not be verified.",
        );
      }
      window.location.assign("/admin");
    } catch (error) {
      if (error && typeof error === "object" && "name" in error) {
        setPasskeyError(
          error.name === "NotAllowedError"
            ? "Passkey sign-in was cancelled."
            : error instanceof Error
              ? error.message
              : "Passkey sign-in failed.",
        );
      } else {
        setPasskeyError(
          error instanceof Error ? error.message : "Passkey sign-in failed.",
        );
      }
    } finally {
      setPasskeyPending(false);
    }
  }

  return (
    <form className="signinForm" action={formAction}>
      <label className="signinField" htmlFor={usernameId}>
        <span>Username</span>
        <input
          id={usernameId}
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          placeholder="Enter username"
          required
          autoFocus
          disabled={pending || passkeyPending}
        />
      </label>
      <label className="signinField" htmlFor={passwordId}>
        <span>Password</span>
        <span className="signinInputWrap">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter password"
            required
            maxLength={MAX_PASSWORD_LENGTH}
            disabled={pending || passkeyPending}
          />
          <button
            type="button"
            className="signinReveal"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            disabled={pending || passkeyPending}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      <button
        className="signinSubmit"
        type="submit"
        disabled={pending || passkeyPending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {passkeyEnabled ? (
        <>
          <div className="signinDivider" aria-hidden="true">
            <span>or</span>
          </div>
          <button
            className="signinPasskey"
            type="button"
            onClick={signInWithPasskey}
            disabled={!passkeySupported || passkeyPending || pending}
          >
            {passkeyPending ? "Waiting for passkey..." : "Sign in with passkey"}
          </button>
        </>
      ) : null}
      {state?.error || passkeyError ? (
        <p className="signinStatus" role="alert">
          {passkeyError || state.error}
        </p>
      ) : null}
    </form>
  );
}
