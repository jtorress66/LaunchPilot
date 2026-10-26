import {
  err,
  formatMetricValue,
  ok,
  weeklyChannelCaps,
  type ProposedTask,
  type Result,
} from "@nuvantre/domain";
import type { CampaignPlan, CampaignPlanner, PlanError, PlanRequest } from "@nuvantre/ports";

const ARTICLES = 2;

const goalOf = ({ lastWeek, product }: PlanRequest) => {
  const clicks = lastWeek?.metrics.find((m) => m.name === "search_clicks");
  return clicks
    ? `Build on last week's ${formatMetricValue("search_clicks", clicks.value)} search clicks`
    : `Grow organic reach for ${product.name}`;
};

/**
 * Deterministic, offline plan: the best keyword opportunities first, then the offered post
 * angles, within each channel's cap and the allowance. For development, tests and E2E.
 */
export class TemplateStrategist implements CampaignPlanner {
  plan(request: PlanRequest): Promise<Result<CampaignPlan, PlanError>> {
    if (request.candidates.keywords.length === 0 && request.candidates.angles.length === 0) {
      return Promise.resolve(
        err({
          code: "planning_failed",
          message: "Nothing was offered to plan from",
          retryable: false,
        }),
      );
    }
    const articles: ProposedTask[] = request.candidates.keywords
      .slice(0, Math.min(ARTICLES, weeklyChannelCaps.blog ?? 0))
      .map((k) => ({
        kind: "seo_article",
        channel: "blog",
        title: `Article: ${k.keyword}`,
        rationale: `${formatMetricValue("visitors", k.monthlySearches)} searches a month at difficulty ${String(k.difficulty)}`,
        keyword: k.keyword,
      }));
    const used = new Map<string, number>();
    const posts: ProposedTask[] = request.candidates.angles.flatMap((a) => {
      const count = used.get(a.channel) ?? 0;
      if (count >= (weeklyChannelCaps[a.channel] ?? 0)) return [];
      used.set(a.channel, count + 1);
      return [
        {
          kind: "social_post" as const,
          channel: a.channel,
          title: a.angle,
          rationale: "Keeps the audience close between articles",
          angle: a.angle,
        },
      ];
    });
    const week = request.week.start.toISOString().slice(0, 10);
    return Promise.resolve(
      ok({
        name: `Week of ${week}`,
        goal: goalOf(request),
        tasks: [...articles, ...posts].slice(0, Math.max(0, request.allowance)),
      }),
    );
  }
}
