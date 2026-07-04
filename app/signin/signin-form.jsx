"use client";

import { useId, useState } from "react";

export default function SignInForm() {
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage("Sign in is not connected yet.");
  };

  return (
    <form className="signinForm" onSubmit={handleSubmit}>
      <label className="signinField" htmlFor={emailId}>
        <span>Email</span>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
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
            placeholder="Password"
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
      <button className="signinSubmit" type="submit">
        Sign in
      </button>
      {message ? (
        <p className="signinStatus" aria-live="polite">
          {message}
        </p>
      ) : null}
    </form>
  );
}
