import { BrandMark } from "./BrandMark";

type AuthenticatedCardProps = {
  email: string;
  accountType: "organization" | "platform";
  role?: string;
  onSignOut: () => void;
};

export function AuthenticatedCard({
  email,
  accountType,
  role,
  onSignOut,
}: AuthenticatedCardProps) {
  return (
    <section className="login-card success-card" aria-live="polite">
      <BrandMark />
      <p className="eyebrow">
        {accountType === "platform" ? "Annavia team account" : "Organization account"}
      </p>
      <h1>You&apos;re signed in.</h1>
      <p className="muted-text">
        {email} is signed in to the{" "}
        <strong>{accountType === "platform" ? "Annavia operations team" : "childcare organization"}</strong>{" "}
        as <strong>{role}</strong>.
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
