"use client";

import { useId, useState } from "react";

export default function SignInForm() {
  const [message, setMessage] = useState("");
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
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          required
        />
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
