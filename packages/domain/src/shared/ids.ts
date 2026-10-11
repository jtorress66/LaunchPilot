declare const brand: unique symbol;

/** Nominal typing: a `Brand<string, "ProductId">` cannot be passed where a `WorkspaceId` is expected. */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type WorkspaceId = Brand<string, "WorkspaceId">;
export type ProductId = Brand<string, "ProductId">;
export type BriefId = Brand<string, "BriefId">;
export type CampaignId = Brand<string, "CampaignId">;
export type TaskId = Brand<string, "TaskId">;
export type ContentItemId = Brand<string, "ContentItemId">;
export type UserId = Brand<string, "UserId">;

/** Ids come from the IdGenerator port or storage, so an empty one is a programmer error. */
const nonEmptyId = (value: string): string => {
  if (value === "") throw new TypeError("An id must not be empty");
  return value;
};

export const workspaceId = (value: string) => nonEmptyId(value) as WorkspaceId;
export const productId = (value: string) => nonEmptyId(value) as ProductId;
export const briefId = (value: string) => nonEmptyId(value) as BriefId;
export const campaignId = (value: string) => nonEmptyId(value) as CampaignId;
export const taskId = (value: string) => nonEmptyId(value) as TaskId;
export const contentItemId = (value: string) => nonEmptyId(value) as ContentItemId;
export const userId = (value: string) => nonEmptyId(value) as UserId;
