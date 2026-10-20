import type {
  Directory,
  LaunchKit,
  ProductId,
  Submission,
  SubmissionId,
} from "@launchpilot/domain";
import type {
  DirectoryCatalog,
  LaunchKitRepository,
  SubmissionRepository,
} from "@launchpilot/ports";
import type { Kysely } from "kysely";
import { directoryMapper, launchKitMapper, submissionMapper } from "../mappers/launch-mappers";
import type { Database } from "../schema";
import { upsert } from "../upsert";

export class PostgresDirectoryCatalog implements DirectoryCatalog {
  constructor(private readonly db: Kysely<Database>) {}

  async list(): Promise<readonly Directory[]> {
    const rows = await this.db.selectFrom("directories").selectAll().orderBy("slug").execute();
    return rows.map(directoryMapper.fromRow);
  }

  async findBySlug(slug: string): Promise<Directory | undefined> {
    const row = await this.db
      .selectFrom("directories")
      .selectAll()
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row && directoryMapper.fromRow(row);
  }
}

export class PostgresLaunchKitRepository implements LaunchKitRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findLatestForProduct(productId: ProductId): Promise<LaunchKit | undefined> {
    const row = await this.db
      .selectFrom("launch_kits")
      .selectAll()
      .where("product_id", "=", productId)
      .executeTakeFirst();
    return row && launchKitMapper.fromRow(row);
  }

  save(kit: LaunchKit): Promise<void> {
    return upsert(this.db, "launch_kits", launchKitMapper.toRow(kit));
  }
}

export class PostgresSubmissionRepository implements SubmissionRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: SubmissionId): Promise<Submission | undefined> {
    const row = await this.db
      .selectFrom("submissions")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row && submissionMapper.fromRow(row);
  }

  async findByProductAndDirectory(
    productId: ProductId,
    directorySlug: string,
  ): Promise<Submission | undefined> {
    const row = await this.db
      .selectFrom("submissions")
      .selectAll()
      .where("product_id", "=", productId)
      .where("directory_slug", "=", directorySlug)
      .executeTakeFirst();
    return row && submissionMapper.fromRow(row);
  }

  async listByProduct(productId: ProductId): Promise<readonly Submission[]> {
    const rows = await this.db
      .selectFrom("submissions")
      .selectAll()
      .where("product_id", "=", productId)
      .orderBy("directory_slug")
      .execute();
    return rows.map(submissionMapper.fromRow);
  }

  save(submission: Submission): Promise<void> {
    return upsert(this.db, "submissions", submissionMapper.toRow(submission));
  }
}
