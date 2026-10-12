/** Row shapes as stored in Postgres. jsonb columns are written as JSON text and read back parsed. */

export interface WorkspaceRow {
  id: string;
  owner_id: string;
  name: string;
  created_at: Date;
}

export interface ProductRow {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  created_at: Date;
}

export interface BriefRow {
  id: string;
  product_id: string;
  version: number;
  status: string;
  content: string;
  approved_by: string | null;
  approved_at: Date | null;
  updated_at: Date;
}

export interface CampaignRow {
  id: string;
  product_id: string;
  name: string;
  goal: string;
  week_starting: Date;
  status: string;
}

export interface TaskRow {
  id: string;
  campaign_id: string;
  kind: string;
  title: string;
  status: string;
  seo_keyword: string | null;
  seo_monthly_searches: number | null;
  seo_difficulty: number | null;
}

export interface ChannelConnectionRow {
  id: string;
  product_id: string;
  channel: string;
  provider: string;
  site_url: string;
  site_name: string;
  username: string;
  encrypted_secret: string;
  connected_at: Date;
}

export interface ContentItemRow {
  id: string;
  product_id: string;
  task_id: string;
  channel: string;
  title: string;
  body: string;
  status: string;
  version: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  review_note: string | null;
  rejection: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  publish_at: Date | null;
  publication_url: string | null;
  published_at: Date | null;
  failure: string | null;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface SessionRow {
  token_hash: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
}

export interface SubscriptionRow {
  workspace_id: string;
  plan: string;
  status: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_end: Date | null;
  updated_at: Date;
}

export interface Database {
  users: UserRow;
  sessions: SessionRow;
  subscriptions: SubscriptionRow;
  workspaces: WorkspaceRow;
  products: ProductRow;
  briefs: BriefRow;
  campaigns: CampaignRow;
  tasks: TaskRow;
  content_items: ContentItemRow;
  channel_connections: ChannelConnectionRow;
}
