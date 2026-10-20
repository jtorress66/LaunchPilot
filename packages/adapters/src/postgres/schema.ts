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
  publish_attempts: number;
}

export interface SocialProfileRow {
  id: string;
  product_id: string;
  provider: string;
  external_profile_id: string;
  /** jsonb: `[{ channel, accountId }]`; text on the way in. */
  linked_accounts: string;
  created_at: Date;
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

export interface DirectoryRow {
  slug: string;
  name: string;
  kind: string;
  channel: string;
  homepage_url: string;
  submit_url: string;
  pricing: string;
  price_note: string | null;
  /** jsonb: string[]; text on the way in. */
  topics: string;
  /** jsonb: { tagline?, shortDescription?, longDescription? }; text on the way in. */
  limits: string;
  checked_at: Date;
}

export interface LaunchKitRow {
  id: string;
  product_id: string;
  version: number;
  status: string;
  /** jsonb: Listing; text on the way in. */
  listing: string;
  approved_by: string | null;
  approved_at: Date | null;
  updated_at: Date;
}

export interface SubmissionRow {
  id: string;
  product_id: string;
  directory_slug: string;
  status: string;
  submitted_at: Date | null;
  listing_url: string | null;
  live_at: Date | null;
  /** jsonb: { reason, at }; text on the way in. */
  rejection: string | null;
  updated_at: Date;
}

export interface AnalyticsConnectionRow {
  id: string;
  product_id: string;
  provider: string;
  encrypted_secret: string;
  account_email: string | null;
  search_console_site: string | null;
  ga4_property_id: string | null;
  site_id: string | null;
  base_url: string | null;
  connected_at: Date;
}

export interface WeeklyReportRow {
  id: string;
  product_id: string;
  week_key: string;
  week_start: Date;
  week_end: Date;
  /** jsonb: metrics, top pages and queries, sources and notes; text on the way in. */
  report: string;
  notes_error: string | null;
  built_at: Date;
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
  social_profiles: SocialProfileRow;
  directories: DirectoryRow;
  launch_kits: LaunchKitRow;
  submissions: SubmissionRow;
  analytics_connections: AnalyticsConnectionRow;
  weekly_reports: WeeklyReportRow;
}
