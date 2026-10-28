import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../../components/auth-shell";
import { LogInForm } from "../../components/forms/auth-forms";
import { parseInviteToken } from "../../server/forms";

export const metadata: Metadata = { title: "Log in — Nuvantre" };

export default async function LogInPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ expired?: string; invite?: string }>;
}) {
  const { expired, invite } = await searchParams;
  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        expired ? "Your session has ended. Please log in again." : "Log in to your workspace."
      }
      footer={
        <>
          New to Nuvantre?{" "}
          <Link
            href="/signup"
            className="font-semibold text-brand-600 hover:underline dark:text-brand-400"
          >
            Create an account
          </Link>
        </>
      }
    >
      <LogInForm invite={parseInviteToken(invite)} />
    </AuthShell>
  );
}
