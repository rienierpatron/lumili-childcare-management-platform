"use client";

import { useState } from "react";
import { apiFetch } from "../lib/api";
import { AuthenticatedCard } from "../components/AuthenticatedCard";
import { BrandMark } from "../components/BrandMark";
import { LoginForm, type LoginScope } from "../components/LoginForm";
import { MarketingPanel } from "../components/MarketingPanel";

type LoginResponse = {
  user: { id: string; email: string };
  tenantId?: string;
  role?: string;
  platformRole?: string;
  accessToken: string;
};

export default function Home() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [session, setSession] = useState<LoginResponse | null>(null);

  async function handleSubmit(credentials: {
    email: string;
    password: string;
    scope: LoginScope;
  }) {
    setError("");
    setIsSubmitting(true);

    try {
      const response = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      });
      window.localStorage.setItem("annavia.accessToken", response.accessToken);
      setSession(response);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (session) {
    return (
      <main className="login-shell">
        <AuthenticatedCard
          email={session.user.email}
          role={session.platformRole ?? session.role}
          onSignOut={() => {
            window.localStorage.removeItem("annavia.accessToken");
            setSession(null);
          }}
        />
      </main>
    );
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <BrandMark />
        <p className="eyebrow">Annavia childcare platform</p>
        <h1>Welcome back.</h1>
        <p className="intro">
          Sign in to manage your childcare organization and keep every family
          connected.
        </p>
        <LoginForm
          error={error}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      </section>
      <MarketingPanel />
    </main>
  );
}
