import type { Role } from "@nuvantre/domain";
import { switchWorkspaceAction } from "../../app/_lib/agency-actions";

export interface SwitcherWorkspace {
  readonly id: string;
  readonly name: string;
  readonly role: Role;
  readonly isClient: boolean;
}

/** Opens another workspace the person can reach. A plain form: it works without JavaScript. */
export function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  readonly current: string;
  readonly workspaces: readonly SwitcherWorkspace[];
}) {
  if (workspaces.length < 2) return null;
  return (
    <form action={switchWorkspaceAction} className="flex items-center gap-2">
      <label htmlFor="workspace-switcher" className="sr-only">
        Workspace
      </label>
      <select
        id="workspace-switcher"
        name="workspaceId"
        defaultValue={current}
        className="max-w-48 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.isClient ? `↳ ${w.name}` : w.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
      >
        Open
      </button>
    </form>
  );
}
