import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in to Serenify",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const isExpiredLink = params.error === "expired_link";

  return (
    <div className="space-y-6">
      {isExpiredLink && (
        <p
          role="status"
          className="rounded-control border border-foggy/30 bg-foggy/10 px-3 py-2 text-sm text-ink"
        >
          Your activation link expired. Please sign in below.
        </p>
      )}
      <LoginForm />
    </div>
  );
}
