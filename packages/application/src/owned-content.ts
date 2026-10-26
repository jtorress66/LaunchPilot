import {
  err,
  ok,
  type Campaign,
  type ContentItem,
  type ContentItemId,
  type Product,
  type Result,
  type Task,
  type TaskId,
  type Workspace,
} from "@nuvantre/domain";
import type {
  CampaignRepository,
  ContentItemRepository,
  ProductRepository,
  TaskRepository,
} from "@nuvantre/ports";
import { failure, type UseCaseError } from "./errors";

const taskNotFound = () => err(failure("task_not_found", "This task does not exist"));
const contentNotFound = () => err(failure("content_not_found", "This content does not exist"));

/** A task with the campaign and product it belongs to, if the workspace owns them. */
export const loadOwnedTask = async (
  deps: {
    readonly tasks: TaskRepository;
    readonly campaigns: CampaignRepository;
    readonly products: ProductRepository;
  },
  workspace: Workspace,
  id: TaskId,
): Promise<Result<{ task: Task; campaign: Campaign; product: Product }, UseCaseError>> => {
  const task = await deps.tasks.findById(id);
  const campaign = task && (await deps.campaigns.findById(task.campaignId));
  const product = campaign && (await deps.products.findById(campaign.productId));
  if (!task || !campaign || product?.workspaceId !== workspace.id) return taskNotFound();
  return ok({ task, campaign, product });
};

/** A content item, if its product belongs to the workspace. Other workspaces' items look missing. */
export const loadOwnedItem = async (
  deps: { readonly contentItems: ContentItemRepository; readonly products: ProductRepository },
  workspace: Workspace,
  id: ContentItemId,
): Promise<Result<{ item: ContentItem; product: Product }, UseCaseError>> => {
  const item = await deps.contentItems.findById(id);
  const product = item && (await deps.products.findById(item.productId));
  if (!item || product?.workspaceId !== workspace.id) return contentNotFound();
  return ok({ item, product });
};
