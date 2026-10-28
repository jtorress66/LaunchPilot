import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../../components/auth-shell";
import { SignUpForm } from "../../components/forms/auth-forms";
import { parseInviteToken } from "../../server/forms";

export const metadata: Metadata = { title: "Create your account — Nuvantre" };

export default async function SignUpPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start free. Upgrade when Nuvantre is pulling its weight."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Log in
          </Link>
        </>
      }
    >
      <SignUpForm invite={parseInviteToken(invite)} />
    </AuthShell>
  );
}
