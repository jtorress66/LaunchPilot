import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvitationForm } from "../../../components/agency/agency-forms";
import { AuthShell } from "../../../components/auth-shell";
import { getAppContainer } from "../../../container";
import { parseInviteToken } from "../../../server/forms";
import { currentUser } from "../../_lib/auth";

export const metadata: Metadata = { title: "Invitation — Nuvantre" };

const roleNames = { member: "a team member", viewer: "a client viewer" } as const;
const link = "font-semibold text-brand-600 hover:underline dark:text-brand-400";

export default async function InvitationPage({
  params,
}: {
  readonly params: Promise<{ token: string }>;
}) {
  const token = parseInviteToken((await params).token);
  const invitation = token ? await getAppContainer().getInvitation.execute(token) : null;
  if (!token || !invitation?.ok) {
    return (
      <AuthShell
        title="Invitation not found"
        subtitle="This link is not valid. Ask for a new one."
        footer={null}
      >
        <Link href="/" className={link}>
          Go to Nuvantre
        </Link>
      </AuthShell>
    );
  }
  const { workspaceName, email, role, expired, accepted } = invitation.value;
  const signedIn = await currentUser();

  return (
    <AuthShell
      title={`Join ${workspaceName}`}
      subtitle={`You're invited as ${roleNames[role]} (${email}).`}
      footer={null}
    >
      {accepted ? (
        <p>
          This invitation has already been accepted.{" "}
          <Link href="/app" className={link}>
            Open the app
          </Link>
        </p>
      ) : expired ? (
        <p>This invitation has expired. Ask for a new one.</p>
      ) : signedIn ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Signed in as {signedIn.user.email}.
          </p>
          <AcceptInvitationForm token={token} />
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <Link href={`/signup?invite=${token}`} className={`${link} block`}>
            Create an account with {email}
          </Link>
          <Link href={`/login?invite=${token}`} className={`${link} block`}>
            I already have an account
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
