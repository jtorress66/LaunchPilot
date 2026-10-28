import { switchWorkspaceAction } from "../../app/_lib/agency-actions";

/** Opens one workspace, e.g. a client from the agency's list. */
export function WorkspaceSwitcherButton({
  workspaceId,
  name,
}: {
  readonly workspaceId: string;
  readonly name: string;
}) {
  return (
    <form action={switchWorkspaceAction}>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <button
        type="submit"
        aria-label={`Open ${name}`}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Open
      </button>
    </form>
  );
}
