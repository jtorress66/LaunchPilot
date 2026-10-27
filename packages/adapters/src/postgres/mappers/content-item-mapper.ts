import {
  channels,
  contentItemId,
  contentItemStatuses,
  parseHttpUrl,
  productId,
  taskId,
  userId,
  type Actor,
  type AgentReview,
  type ArticleSeo,
  type ContentItem,
  type HttpUrl,
} from "@nuvantre/domain";
import type { ContentItemRow } from "../schema";
import { oneOf, readJson, toJson } from "./columns";

interface StoredRejection {
  readonly by: Actor;
  readonly reason: string;
  readonly at: string;
}

interface StoredFailure {
  readonly reason: string;
  readonly at: string;
}

const readActor = (value: unknown, column: string): Actor => {
  const actor = readJson(value) as Partial<Record<"kind" | "userId" | "agent", string>>;
  if (actor.kind === "founder" && actor.userId)
    return { kind: "founder", userId: userId(actor.userId) };
  if (actor.kind === "agent" && actor.agent) return actor as Actor;
  throw new Error(`Unexpected actor in ${column}`);
};

const readUrl = (value: string): HttpUrl => {
  const url = parseHttpUrl(value);
  if (!url.ok) throw new Error(`Unexpected value "${value}" in content_items.publication_url`);
  return url.value;
};

const readRejection = (value: string | null): ContentItem["rejection"] => {
  if (value === null) return null;
  const stored = readJson(value) as StoredRejection;
  return {
    by: readActor(stored.by, "content_items.rejection"),
    reason: stored.reason,
    at: new Date(stored.at),
  };
};

const readFailure = (value: string | null): ContentItem["failure"] => {
  if (value === null) return null;
  const stored = readJson(value) as StoredFailure;
  return { reason: stored.reason, at: new Date(stored.at) };
};

type StoredAgentReview = Omit<AgentReview, "reviewedAt"> & { readonly reviewedAt: string };

const readAgentReview = (value: string | null): AgentReview | null => {
  if (value === null) return null;
  const stored = readJson(value) as StoredAgentReview;
  return { ...stored, reviewedAt: new Date(stored.reviewedAt) };
};

const readSeo = (value: string | null): ArticleSeo | null =>
  value === null ? null : (readJson(value) as ArticleSeo);

export const contentItemMapper = {
  toRow: (item: ContentItem): ContentItemRow => ({
    id: item.id,
    product_id: item.productId,
    task_id: item.taskId,
    channel: item.channel,
    title: item.title,
    body: item.body,
    status: item.status,
    version: item.version,
    created_by: toJson(item.createdBy),
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    review_note: item.reviewNote,
    rejection:
      item.rejection === null
        ? null
        : toJson({
            ...item.rejection,
            at: item.rejection.at.toISOString(),
          } satisfies StoredRejection),
    approved_by: item.approval?.by ?? null,
    approved_at: item.approval?.at ?? null,
    publish_at: item.publishAt,
    publication_url: item.publication?.externalUrl ?? null,
    published_at: item.publication?.at ?? null,
    failure:
      item.failure === null
        ? null
        : toJson({ ...item.failure, at: item.failure.at.toISOString() } satisfies StoredFailure),
    publish_attempts: item.publishAttempts,
    seo: item.seo === null ? null : toJson(item.seo),
    agent_review:
      item.agentReview === null
        ? null
        : toJson({
            ...item.agentReview,
            reviewedAt: item.agentReview.reviewedAt.toISOString(),
          } satisfies StoredAgentReview),
  }),
  fromRow: (row: ContentItemRow): ContentItem => ({
    id: contentItemId(row.id),
    productId: productId(row.product_id),
    taskId: taskId(row.task_id),
    channel: oneOf(channels, row.channel, "content_items.channel"),
    title: row.title,
    body: row.body,
    status: oneOf(contentItemStatuses, row.status, "content_items.status"),
    version: row.version,
    createdBy: readActor(row.created_by, "content_items.created_by"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewNote: row.review_note,
    rejection: readRejection(row.rejection),
    approval:
      row.approved_by !== null && row.approved_at !== null
        ? { by: userId(row.approved_by), at: row.approved_at }
        : null,
    publishAt: row.publish_at,
    publication:
      row.publication_url !== null && row.published_at !== null
        ? { externalUrl: readUrl(row.publication_url), at: row.published_at }
        : null,
    failure: readFailure(row.failure),
    publishAttempts: row.publish_attempts,
    seo: readSeo(row.seo),
    agentReview: readAgentReview(row.agent_review),
  }),
};
