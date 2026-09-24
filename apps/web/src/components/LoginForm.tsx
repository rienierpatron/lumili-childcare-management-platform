"use client";

import { FormEvent, useState } from "react";

export type LoginScope = "tenant" | "platform";

type LoginFormProps = {
  error: string;
  isSubmitting: boolean;
  onSubmit: (credentials: {
    email: string;
    password: string;
    scope: LoginScope;
  }) => void;
};

export function LoginForm({
  error,
  isSubmitting,
  onSubmit,
}: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState<LoginScope>("tenant");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ email, password, scope });
  }

  return (
    <>
      <div className="scope-toggle" role="group" aria-label="Account type">
        <button
          className={scope === "tenant" ? "scope-active" : ""}
          type="button"
          onClick={() => setScope("tenant")}
        >
          Organization
        </button>
        <button
          className={scope === "platform" ? "scope-active" : ""}
          type="button"
          onClick={() => setScope("platform")}
        >
          Annavia team
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <div className="label-row">
          <label htmlFor="password">Password</label>
          <button className="text-button" type="button">
            Forgot password?
          </button>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={12}
        />

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="footer-copy">
        New to Annavia?{" "}
        <span>Ask your organization owner for an invitation.</span>
      </p>
    </>
  );
}
