import {
  buildCalendar,
  linkedChannels,
  ok,
  socialChannels,
  type Calendar,
  type Channel,
  type ContentItem,
  type Product,
  type ProductId,
  type Result,
  type SocialChannel,
  type Workspace,
} from "@launchpilot/domain";
import type {
  BriefRepository,
  Clock,
  ContentItemRepository,
  ProductRepository,
  SocialProfileRepository,
} from "@launchpilot/ports";
import type { UseCaseError } from "./errors";
import { loadOwnedProduct } from "./owned-product";

const CALENDAR_DAYS = 14;

export interface SocialOverview {
  readonly product: Product;
  readonly briefApproved: boolean;
  /** null until the founder connects; never includes the profile key. */
  readonly linkedChannels: readonly SocialChannel[] | null;
  /** This product's X and LinkedIn posts, newest first. */
  readonly posts: readonly ContentItem[];
  readonly calendar: Calendar;
}

const isSocial = (channel: Channel) => (socialChannels as readonly Channel[]).includes(channel);

/** Everything the Social page shows: linked accounts, posts and the next two weeks. */
export class GetSocialOverview {
  constructor(
    private readonly deps: {
      readonly products: ProductRepository;
      readonly briefs: BriefRepository;
      readonly contentItems: ContentItemRepository;
      readonly socialProfiles: SocialProfileRepository;
      readonly clock: Clock;
    },
  ) {}

  async execute(input: {
    workspace: Workspace;
    productId: ProductId;
  }): Promise<Result<SocialOverview, UseCaseError>> {
    const product = await loadOwnedProduct(this.deps.products, input.workspace, input.productId);
    if (!product.ok) return product;
    const id = product.value.id;
    const [brief, profile, items] = await Promise.all([
      this.deps.briefs.findLatestForProduct(id),
      this.deps.socialProfiles.findByProduct(id),
      this.deps.contentItems.listByProduct(id),
    ]);
    const posts = items.filter((item) => isSocial(item.channel));
    return ok({
      product: product.value,
      briefApproved: brief?.status === "approved",
      linkedChannels: profile ? linkedChannels(profile) : null,
      posts,
      calendar: buildCalendar(posts, { from: this.deps.clock.now(), days: CALENDAR_DAYS }),
    });
  }
}
