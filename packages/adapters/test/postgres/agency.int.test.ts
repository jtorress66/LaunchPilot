import {
  describeBrandingRepositoryContract,
  describeInvitationRepositoryContract,
  describeMembershipRepositoryContract,
  describeReportRecipientRepositoryContract,
} from "@nuvantre/testing/contracts";
import { userId } from "@nuvantre/domain";
import { aUser } from "@nuvantre/testing";
import { afterAll } from "vitest";
import {
  PostgresBrandingRepository,
  PostgresInvitationRepository,
  PostgresMembershipRepository,
  PostgresReportRecipientRepository,
} from "../../src/postgres";
import { userMapper } from "../../src/postgres/mappers/user-mapper";
import { connect, resetWith } from "./test-db";

const db = connect();
afterAll(async () => {
  await db.destroy();
});

/** The membership contract uses a few more people than the shared fixtures seed. */
const withPeople = async () => {
  await resetWith(db, "workspaces");
  await db
    .insertInto("users")
    .values(
      ["user_1", "user_2", "user_9"].map((id) =>
        userMapper.toRow(aUser({ id: userId(id), email: `${id}@acme.dev` })),
      ),
    )
    .execute();
};

describeMembershipRepositoryContract("PostgresMembershipRepository", async () => {
  await withPeople();
  return new PostgresMembershipRepository(db);
});

describeInvitationRepositoryContract("PostgresInvitationRepository", async () => {
  await resetWith(db, "workspaces");
  return new PostgresInvitationRepository(db);
});

describeBrandingRepositoryContract("PostgresBrandingRepository", async () => {
  await resetWith(db, "workspaces");
  return new PostgresBrandingRepository(db);
});

describeReportRecipientRepositoryContract("PostgresReportRecipientRepository", async () => {
  await resetWith(db, "products");
  return new PostgresReportRecipientRepository(db);
});
