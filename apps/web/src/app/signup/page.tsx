import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../../components/auth-shell";
import { SignUpForm } from "../../components/forms/auth-forms";

export const metadata: Metadata = { title: "Create your account — LaunchPilot" };

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Start free. Upgrade when LaunchPilot is pulling its weight."
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
      <SignUpForm />
    </AuthShell>
  );
}
