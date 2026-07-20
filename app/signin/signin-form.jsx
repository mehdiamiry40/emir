"use client";

import { useActionState, useId, useState } from "react";
import { signIn } from "./actions";

const initialState = { error: null };

export default function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const usernameId = useId();
  const passwordId = useId();

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
          />
          <button
            type="button"
            className="signinReveal"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      <button className="signinSubmit" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state?.error ? (
        <p className="signinStatus" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
