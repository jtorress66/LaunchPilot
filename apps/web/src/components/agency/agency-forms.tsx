"use client";

import { useActionState } from "react";
import {
  acceptInvitationAction,
  addClientAction,
  inviteMemberAction,
  removeMemberAction,
  sendReportAction,
  updateBrandingAction,
  type AgencyFormState,
} from "../../app/_lib/agency-actions";
import { Field } from "../forms/field";
import { FormError } from "../forms/form-error";
import { SubmitButton } from "../forms/submit-button";

const initial: AgencyFormState = {};

function Done({ message }: { readonly message?: string | undefined }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
    >
      {message}
    </p>
  );
}

const select =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900";

export function AddClientForm() {
  const [state, action] = useActionState(addClientAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.errors?.form} />
      <Done message={state.done} />
      <Field label="Client name" name="name" placeholder="Acme Corp" error={state.errors?.name} />
      <SubmitButton pending="Adding…">Add client</SubmitButton>
    </form>
  );
}

export function InviteForm() {
  const [state, action] = useActionState(inviteMemberAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.errors?.form} />
      <Done message={state.done} />
      <Field label="Email" name="email" type="email" error={state.errors?.email} />
      <div className="space-y-1.5">
        <label htmlFor="role" className="block text-sm font-medium">
          Role
        </label>
        <select id="role" name="role" defaultValue="viewer" className={select}>
          <option value="viewer">Client viewer — sees reports and activity</option>
          <option value="member">Team member — drafts, approves and publishes</option>
        </select>
      </div>
      <SubmitButton pending="Sending…">Send invitation</SubmitButton>
    </form>
  );
}

export function RemoveMemberButton({
  userId,
  email,
}: {
  readonly userId: string;
  readonly email: string;
}) {
  const [state, action] = useActionState<AgencyFormState>(
    removeMemberAction.bind(null, userId),
    initial,
  );
  return (
    <form action={action} className="space-y-1">
      <button
        type="submit"
        aria-label={`Remove ${email}`}
        className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Remove
      </button>
      <FormError message={state.errors?.form} />
    </form>
  );
}

export function BrandingForm({
  defaults,
}: {
  readonly defaults: {
    readonly senderName: string;
    readonly accentColor: string;
    readonly logoUrl: string;
    readonly replyTo: string;
    readonly footer: string;
  };
}) {
  const [state, action] = useActionState(updateBrandingAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.errors?.form} />
      <Done message={state.done} />
      <Field
        label="Sender name"
        name="senderName"
        defaultValue={defaults.senderName}
        hint="Reports come from this name."
        error={state.errors?.senderName}
      />
      <Field
        label="Accent colour"
        name="accentColor"
        defaultValue={defaults.accentColor}
        placeholder="#0f766e"
        error={state.errors?.accentColor}
      />
      <Field
        label="Logo URL"
        name="logoUrl"
        type="url"
        defaultValue={defaults.logoUrl}
        hint="Optional. An https:// image, about 32px tall."
        error={state.errors?.logoUrl}
      />
      <Field
        label="Reply-to address"
        name="replyTo"
        type="email"
        defaultValue={defaults.replyTo}
        error={state.errors?.replyTo}
      />
      <Field
        label="Footer"
        name="footer"
        defaultValue={defaults.footer}
        hint="Optional, for example your address."
        error={state.errors?.footer}
      />
      <SubmitButton pending="Saving…">Save branding</SubmitButton>
    </form>
  );
}

export function SendReportForm({
  productId,
  weekKey,
  recipients,
  weekly,
}: {
  readonly productId: string;
  readonly weekKey: string;
  readonly recipients: string;
  readonly weekly: boolean;
}) {
  const [state, action] = useActionState<AgencyFormState, FormData>(
    sendReportAction.bind(null, productId, weekKey),
    initial,
  );
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError message={state.errors?.form} />
      <Done message={state.done} />
      <Field
        label="Send to"
        name="recipients"
        defaultValue={recipients}
        placeholder="client@acme.com, boss@acme.com"
        hint="Up to 10 addresses, separated by commas."
        error={state.errors?.recipients}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="weekly" defaultChecked={weekly} />
        Email every new weekly report to these addresses
      </label>
      <SubmitButton pending="Sending…">Email this report</SubmitButton>
    </form>
  );
}

export function AcceptInvitationForm({ token }: { readonly token: string }) {
  const [state, action] = useActionState<AgencyFormState>(
    acceptInvitationAction.bind(null, token),
    initial,
  );
  return (
    <form action={action} className="space-y-3">
      <FormError message={state.errors?.form} />
      <SubmitButton pending="Joining…">Accept invitation</SubmitButton>
    </form>
  );
}
