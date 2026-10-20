import type { Product, ProductId, WorkspaceId } from "@launchpilot/domain";
import type { ProductRepository } from "@launchpilot/ports";
import type { Kysely } from "kysely";
import { productMapper } from "../mappers/product-mapper";
import type { Database } from "../schema";
import { upsert } from "../upsert";

export class PostgresProductRepository implements ProductRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async findById(id: ProductId): Promise<Product | undefined> {
    const row = await this.db
      .selectFrom("products")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row && productMapper.fromRow(row);
  }

  save(product: Product): Promise<void> {
    return upsert(this.db, "products", productMapper.toRow(product));
  }

  async listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Product[]> {
    const rows = await this.db
      .selectFrom("products")
      .selectAll()
      .where("workspace_id", "=", workspaceId)
      .orderBy("created_at")
      .orderBy("id")
      .execute();
    return rows.map(productMapper.fromRow);
  }

  async listWithAutopilot(): Promise<readonly Product[]> {
    const rows = await this.db
      .selectFrom("products")
      .selectAll()
      .where("autopilot_since", "is not", null)
      .orderBy("id")
      .execute();
    return rows.map(productMapper.fromRow);
  }
}
