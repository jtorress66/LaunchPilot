import { productId, userId, type Role, type User, type Workspace } from "@nuvantre/domain";
import { aProduct, aSubscription, aWeeklyReport, aWorkspace } from "@nuvantre/testing";
import { describe, expect, it } from "vitest";
import {
  AcceptInvitation,
  AddClient,
  ApproveBrief,
  ApproveContentItem,
  ApproveLaunchKit,
  CreateProduct,
  PublishContentItem,
  SchedulePost,
  UnschedulePost,
  AuthenticateSession,
  GetBranding,
  GetInvitation,
  GetReportRecipients,
  InviteMember,
  ListClients,
  ListTeam,
  RemoveMember,
  SendReport,
  SendWeeklyReportEmails,
  SwitchWorkspace,
  UpdateBranding,
  type WorkspaceAccess,
} from "../src";
import { makeWorld, signedUp, type World } from "./world";

type Signed = Awaited<ReturnType<typeof signedUp>>;

const access = (
  s: { user: User; workspace: Workspace },
  role: Role = "owner",
): WorkspaceAccess => ({
  user: s.user,
  workspace: s.workspace,
  role,
});

/** A founder on the Agency plan. */
const anAgency = async (world: World) => {
  const s = await signedUp(world, "owner@brightside.agency");
  await world.subscriptions.save(aSubscription({ workspaceId: s.workspace.id, plan: "agency" }));
  return s;
};

const addClient = async (world: World, s: Signed, name = "Acme Corp") => {
  const added = await new AddClient(world).execute({ access: access(s), name });
  if (!added.ok) throw new Error(added.error.message);
  return added.value;
};

const brand = (world: World, s: Signed) =>
  new UpdateBranding(world).execute({
    access: access(s),
    senderName: "Brightside Agency",
    accentColor: "#0f766e",
    logoUrl: "",
    replyTo: "hello@brightside.agency",
    footer: "",
  });

describe("SignUp", () => {
  it("makes the founder the owner member of their new workspace", async () => {
    const world = makeWorld();
    const { user, workspace } = await signedUp(world);
    expect(await world.memberships.find(workspace.id, user.id)).toMatchObject({ role: "owner" });
  });
});

describe("AuthenticateSession with agencies", () => {
  it("opens the founder's own workspace and lists every workspace they can reach", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const client = await addClient(world, s);
    const result = await new AuthenticateSession(world).execute(s.session.token);
    expect(result).toMatchObject({ ok: true, value: { workspace: s.workspace, role: "owner" } });
    expect(result.ok && result.value.workspaces).toEqual([
      { workspace: s.workspace, role: "owner" },
      { workspace: client, role: "owner" },
    ]);
  });

  it("opens the workspace the person switched to, with their role there", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const client = await addClient(world, s);
    expect(
      await new SwitchWorkspace(world).execute({ token: s.session.token, workspaceId: client.id }),
    ).toEqual({ ok: true, value: client });
    expect(await new AuthenticateSession(world).execute(s.session.token)).toMatchObject({
      ok: true,
      value: { workspace: client, role: "owner" },
    });
  });

  it("refuses to switch to a workspace the person cannot reach", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const stranger = await signedUp(world, "stranger@globex.test");
    expect(
      await new SwitchWorkspace(world).execute({
        token: s.session.token,
        workspaceId: stranger.workspace.id,
      }),
    ).toMatchObject({ ok: false, error: { code: "workspace_not_found" } });
  });

  it("falls back to the person's own workspace when they lose access to the one in use", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const member = await signedUp(world, "member@brightside.agency");
    await world.memberships.save({
      workspaceId: s.workspace.id,
      userId: member.user.id,
      role: "member",
      createdAt: world.clock.now(),
    });
    await new SwitchWorkspace(world).execute({
      token: member.session.token,
      workspaceId: s.workspace.id,
    });
    await world.memberships.delete(s.workspace.id, member.user.id);
    expect(await new AuthenticateSession(world).execute(member.session.token)).toMatchObject({
      ok: true,
      value: { workspace: member.workspace, role: "owner" },
    });
  });
});

describe("AddClient", () => {
  it("adds a client workspace to an agency and records it", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const client = await addClient(world, s, " Acme Corp ");
    expect(client).toMatchObject({ name: "Acme Corp", agencyId: s.workspace.id });
    expect(await new ListClients(world).execute({ access: access(s) })).toEqual({
      ok: true,
      value: [{ workspace: client, products: 0 }],
    });
    expect(world.audit.entries.at(-1)).toMatchObject({
      action: "client_added",
      subject: { kind: "workspace", id: client.id, label: "Acme Corp" },
    });
  });

  it("needs the Agency plan", async () => {
    const world = makeWorld();
    const s = await signedUp(world);
    await world.subscriptions.save(aSubscription({ workspaceId: s.workspace.id, plan: "growth" }));
    expect(await new AddClient(world).execute({ access: access(s), name: "Acme" })).toMatchObject({
      ok: false,
      error: { code: "agency_plan_required" },
    });
  });

  it("stops at the plan's ten clients", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    for (let n = 1; n <= 10; n += 1) await addClient(world, s, `Client ${String(n)}`);
    expect(await new AddClient(world).execute({ access: access(s), name: "Eleven" })).toMatchObject(
      {
        ok: false,
        error: { code: "plan_limit_reached" },
      },
    );
  });

  it("is for the agency's owner, and not from inside a client", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    expect(
      await new AddClient(world).execute({ access: access(s, "member"), name: "Acme" }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    const client = await addClient(world, s);
    expect(
      await new AddClient(world).execute({
        access: { ...access(s), workspace: client },
        name: "Sub",
      }),
    ).toMatchObject({ ok: false, error: { code: "agency_plan_required" } });
  });
});

describe("Team: invite, accept and remove", () => {
  const invite = async (world: World, s: Signed, workspace: Workspace, role = "viewer") =>
    new InviteMember(world).execute({
      access: { ...access(s), workspace },
      email: "Client@Acme.test",
      role,
    });

  const linkIn = (world: World) => {
    const text = world.mailer.sent.at(-1)?.text ?? "";
    const token = /\/invite\/([A-Za-z0-9_-]+)/.exec(text)?.[1];
    if (!token) throw new Error("no invite link");
    return token;
  };

  it("emails an invitation link and stores only the token's hash", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const client = await addClient(world, s);
    expect(await invite(world, s, client)).toMatchObject({
      ok: true,
      value: { email: "client@acme.test", role: "viewer" },
    });
    const sent = world.mailer.sent.at(-1);
    expect(sent?.to).toEqual(["client@acme.test"]);
    expect(sent?.subject).toBe("You're invited to Acme Corp");
    const token = linkIn(world);
    expect(sent?.text).toContain(`https://app.nuvantre.test/invite/${token}`);
    const [pending] = await world.invitations.listPending(client.id);
    expect(pending?.tokenHash).toBe(world.tokenHasher.hash(token));
    expect(pending?.tokenHash).not.toContain(token);
    expect(world.audit.entries.at(-1)).toMatchObject({ action: "member_invited" });
  });

  it("lets the invited person join with the invited role, opening that workspace", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const client = await addClient(world, s);
    await invite(world, s, client);
    const token = linkIn(world);
    expect(await new GetInvitation(world).execute(token)).toMatchObject({
      ok: true,
      value: { workspaceName: "Acme Corp", email: "client@acme.test", role: "viewer" },
    });
    const viewer = await signedUp(world, "client@acme.test");
    expect(
      await new AcceptInvitation(world).execute({
        token,
        user: viewer.user,
        sessionToken: viewer.session.token,
      }),
    ).toEqual({ ok: true, value: client });
    const signedIn = await new AuthenticateSession(world).execute(viewer.session.token);
    expect(signedIn).toMatchObject({ ok: true, value: { workspace: client, role: "viewer" } });
    expect(signedIn.ok && signedIn.value.workspaces.map((w) => w.workspace.name)).toEqual([
      "My workspace",
      "Acme Corp",
    ]);
    expect(world.audit.entries.at(-1)).toMatchObject({ action: "member_joined" });
  });

  it("refuses an unknown link and another person's invitation", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const client = await addClient(world, s);
    await invite(world, s, client);
    const token = linkIn(world);
    const other = await signedUp(world, "other@acme.test");
    const accept = (t: string) =>
      new AcceptInvitation(world).execute({
        token: t,
        user: other.user,
        sessionToken: other.session.token,
      });
    expect(await accept("nope")).toMatchObject({
      ok: false,
      error: { code: "invitation_not_found" },
    });
    expect(await accept(token)).toMatchObject({
      ok: false,
      error: { code: "invitation_email_mismatch" },
    });
  });

  it("is for owners only, and never invites an owner", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    expect(
      await new InviteMember(world).execute({
        access: access(s, "member"),
        email: "a@acme.test",
        role: "viewer",
      }),
    ).toMatchObject({ ok: false, error: { code: "forbidden" } });
    expect(await invite(world, s, s.workspace, "owner")).toMatchObject({
      ok: false,
      error: { code: "invalid_role" },
    });
    expect(world.mailer.sent).toEqual([]);
  });

  it("lists members with their addresses and removes them, but never the last owner", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const member = await signedUp(world, "member@brightside.agency");
    await world.memberships.save({
      workspaceId: s.workspace.id,
      userId: member.user.id,
      role: "member",
      createdAt: world.clock.now(),
    });
    const team = await new ListTeam(world).execute({ access: access(s) });
    expect(team.ok && team.value.members.map((m) => [m.email, m.role])).toEqual([
      ["owner@brightside.agency", "owner"],
      ["member@brightside.agency", "member"],
    ]);
    expect(
      await new RemoveMember(world).execute({ access: access(s), userId: member.user.id }),
    ).toEqual({ ok: true, value: null });
    expect(await world.memberships.find(s.workspace.id, member.user.id)).toBeUndefined();
    expect(
      await new RemoveMember(world).execute({ access: access(s), userId: s.user.id }),
    ).toMatchObject({ ok: false, error: { code: "last_owner" } });
    expect(
      await new RemoveMember(world).execute({ access: access(s), userId: userId("user_nobody") }),
    ).toMatchObject({ ok: false, error: { code: "member_not_found" } });
  });
});

describe("Branding", () => {
  it("is set on the agency and shared by its clients", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const client = await addClient(world, s);
    expect(await brand(world, s)).toMatchObject({
      ok: true,
      value: { senderName: "Brightside Agency", accentColor: "#0f766e", logoUrl: null },
    });
    expect(
      await new GetBranding(world).execute({ access: { ...access(s), workspace: client } }),
    ).toMatchObject({ ok: true, value: { senderName: "Brightside Agency" } });
    expect(world.audit.entries.at(-1)).toMatchObject({ action: "branding_updated" });
  });

  it("is changed only by the agency's owner, and not from a client", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const client = await addClient(world, s);
    const update = (a: WorkspaceAccess) =>
      new UpdateBranding(world).execute({
        access: a,
        senderName: "X",
        accentColor: "#000000",
        replyTo: "x@x.test",
      });
    expect(await update(access(s, "member"))).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(await update({ ...access(s), workspace: client })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
  });
});

describe("SendReport", () => {
  const withReport = async (world: World) => {
    const s = await anAgency(world);
    const client = await addClient(world, s);
    await brand(world, s);
    const product = aProduct({
      id: productId("prod_acme"),
      workspaceId: client.id,
      name: "Acme Analytics",
    });
    await world.products.save(product);
    const report = aWeeklyReport({ productId: product.id });
    await world.weeklyReports.save(report);
    return { s, client, product, report, clientAccess: { ...access(s), workspace: client } };
  };

  it("emails a client's report under the agency's brand and remembers the recipients", async () => {
    const world = makeWorld();
    const { client, product, report, clientAccess } = await withReport(world);
    const sent = await new SendReport(world).execute({
      access: clientAccess,
      productId: product.id,
      weekKey: report.weekKey,
      recipients: "client@acme.test, boss@acme.test",
      weekly: true,
    });
    expect(sent).toEqual({ ok: true, value: { to: ["client@acme.test", "boss@acme.test"] } });
    const [email] = world.mailer.sent;
    expect(email).toMatchObject({
      to: ["client@acme.test", "boss@acme.test"],
      fromName: "Brightside Agency",
      replyTo: "hello@brightside.agency",
      subject: `Acme Analytics — weekly report, ${report.weekKey}`,
    });
    expect(email?.html).toContain("#0f766e");
    expect(await world.reportRecipients.findByProduct(product.id)).toMatchObject({
      emails: ["client@acme.test", "boss@acme.test"],
      weekly: true,
    });
    expect(world.audit.entries.at(-1)).toMatchObject({
      workspaceId: client.id,
      action: "report_sent",
      subject: { kind: "report", id: report.id, label: `Acme Analytics ${report.weekKey}` },
    });
  });

  it("uses one idempotency key per report, recipients and day", async () => {
    const world = makeWorld();
    const { product, report, clientAccess } = await withReport(world);
    const send = () =>
      new SendReport(world).execute({
        access: clientAccess,
        productId: product.id,
        weekKey: report.weekKey,
        recipients: "client@acme.test",
        weekly: false,
      });
    await send();
    await send();
    expect(world.mailer.sent).toHaveLength(1);
  });

  it("refuses bad addresses, a missing report and a client viewer", async () => {
    const world = makeWorld();
    const { product, report, clientAccess } = await withReport(world);
    const send = (input: Partial<Parameters<SendReport["execute"]>[0]>) =>
      new SendReport(world).execute({
        access: clientAccess,
        productId: product.id,
        weekKey: report.weekKey,
        recipients: "client@acme.test",
        weekly: false,
        ...input,
      });
    expect(await send({ recipients: "nope" })).toMatchObject({
      ok: false,
      error: { code: "invalid_email" },
    });
    expect(await send({ weekKey: "1999-W01" })).toMatchObject({
      ok: false,
      error: { code: "report_not_found" },
    });
    expect(await send({ access: { ...clientAccess, role: "viewer" } })).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
    });
    expect(world.mailer.sent).toEqual([]);
  });

  it("passes on the mailer's refusal and records nothing", async () => {
    const world = makeWorld();
    const { product, report, clientAccess } = await withReport(world);
    const before = world.audit.entries.length;
    world.mailer.failNext({
      code: "mailer_rejected",
      message: "Sender not verified",
      retryable: false,
    });
    expect(
      await new SendReport(world).execute({
        access: clientAccess,
        productId: product.id,
        weekKey: report.weekKey,
        recipients: "client@acme.test",
        weekly: true,
      }),
    ).toMatchObject({ ok: false, error: { code: "mailer_rejected" } });
    expect(world.audit.entries).toHaveLength(before);
    expect(await world.reportRecipients.findByProduct(product.id)).toBeUndefined();
  });
});

describe("SendWeeklyReportEmails", () => {
  it("emails each new report to its product's weekly list, and skips the rest", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const client = await addClient(world, s);
    const weekly = aProduct({
      id: productId("prod_weekly"),
      workspaceId: client.id,
      name: "Weekly",
    });
    const manual = aProduct({
      id: productId("prod_manual"),
      workspaceId: client.id,
      name: "Manual",
    });
    await world.products.save(weekly);
    await world.products.save(manual);
    await world.reportRecipients.save({
      productId: weekly.id,
      emails: ["client@acme.test" as never],
      weekly: true,
    });
    await world.reportRecipients.save({
      productId: manual.id,
      emails: ["client@acme.test" as never],
      weekly: false,
    });
    const reports = [
      aWeeklyReport({ id: "rep_w", productId: weekly.id }),
      aWeeklyReport({ id: "rep_m", productId: manual.id }),
    ];
    expect(await new SendWeeklyReportEmails(world).execute(reports)).toEqual({
      sent: 1,
      failed: 0,
    });
    expect(world.mailer.sent.map((m) => m.subject)).toEqual([
      `Weekly — weekly report, ${reports[0]?.weekKey ?? ""}`,
    ]);
    expect(world.audit.entries.at(-1)).toMatchObject({
      action: "report_sent",
      actor: { kind: "system" },
    });
  });

  it("counts a failed email and reports it without stopping the others", async () => {
    const world = makeWorld();
    const product = aProduct();
    await world.workspaces.save(aWorkspace());
    await world.products.save(product);
    await world.reportRecipients.save({
      productId: product.id,
      emails: ["client@acme.test" as never],
      weekly: true,
    });
    world.mailer.failNext({ code: "mailer_unavailable", message: "down", retryable: true });
    expect(await new SendWeeklyReportEmails(world).execute([aWeeklyReport()])).toEqual({
      sent: 0,
      failed: 1,
    });
    expect(world.errors.reports).toHaveLength(1);
  });
});

describe("a client viewer", () => {
  const viewerOf = async (world: World) => {
    const s = await anAgency(world);
    const client = await addClient(world, s);
    const viewer = await signedUp(world, "client@acme.test");
    return { s, client, viewerAccess: { ...access(viewer, "viewer"), workspace: client } };
  };

  it("can never approve, schedule or publish anything, even by calling the use case", async () => {
    const world = makeWorld();
    const { viewerAccess } = await viewerOf(world);
    const itemId = "item_1" as never;
    const refusals = [
      await new ApproveContentItem(world).execute({ access: viewerAccess, itemId }),
      await new PublishContentItem(world).execute({ access: viewerAccess, itemId }),
      await new SchedulePost(world).execute({
        access: viewerAccess,
        itemId,
        publishAt: new Date("2026-06-01T10:00:00Z"),
      }),
      await new UnschedulePost(world).execute({ access: viewerAccess, itemId }),
      await new ApproveBrief(world).execute({
        access: viewerAccess,
        productId: productId("prod_1"),
      }),
      await new ApproveLaunchKit(world).execute({
        access: viewerAccess,
        productId: productId("prod_1"),
      }),
    ];
    for (const refusal of refusals) {
      expect(refusal).toMatchObject({ ok: false, error: { code: "forbidden" } });
    }
  });

  it("lets the agency's members create products in a client on the client plan's limits", async () => {
    const world = makeWorld();
    const { s, client } = await viewerOf(world);
    const create = (n: number) =>
      new CreateProduct(world).execute({
        workspace: client,
        name: `Product ${String(n)}`,
        url: `https://p${String(n)}.acme.test`,
      });
    for (const n of [1, 2, 3]) expect((await create(n)).ok).toBe(true);
    expect(await create(4)).toMatchObject({ ok: false, error: { code: "plan_limit_reached" } });
    expect(s.workspace.agencyId).toBeNull();
  });
});

describe("GetReportRecipients", () => {
  it("returns a product's saved list, or null before the first email", async () => {
    const world = makeWorld();
    const s = await anAgency(world);
    const product = aProduct({ workspaceId: s.workspace.id });
    await world.products.save(product);
    const get = () =>
      new GetReportRecipients(world).execute({ access: access(s), productId: product.id });
    expect(await get()).toEqual({ ok: true, value: null });
    await world.reportRecipients.save({
      productId: product.id,
      emails: ["client@acme.test" as never],
      weekly: true,
    });
    expect(await get()).toMatchObject({ ok: true, value: { weekly: true } });
    expect(
      await new GetReportRecipients(world).execute({
        access: access(s),
        productId: productId("prod_other"),
      }),
    ).toMatchObject({ ok: false, error: { code: "product_not_found" } });
  });
});
