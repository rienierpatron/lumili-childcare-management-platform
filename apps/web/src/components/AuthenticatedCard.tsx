import { BrandMark } from "./BrandMark";

type AuthenticatedCardProps = {
  email: string;
  role?: string;
  onSignOut: () => void;
};

export function AuthenticatedCard({
  email,
  role,
  onSignOut,
}: AuthenticatedCardProps) {
  return (
    <section className="login-card success-card" aria-live="polite">
      <BrandMark />
      <p className="eyebrow">Welcome back</p>
      <h1>You&apos;re signed in.</h1>
      <p className="muted-text">
        {email} is signed in as <strong>{role}</strong>.
      </p>
      <p className="notice">
        Dashboard and tenant selection will be available in the next step.
      </p>
      <button className="secondary-button" type="button" onClick={onSignOut}>
        Sign out
      </button>
    </section>
  );
}
