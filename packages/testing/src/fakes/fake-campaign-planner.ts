import { err, ok, type ProposedTask, type Result } from "@nuvantre/domain";
import type { CampaignPlan, CampaignPlanner, PlanError, PlanRequest } from "@nuvantre/ports";
import { NextFailure } from "./next-failure";

/** By default plans two articles and the offered posts, within the allowance; records requests. */
export class FakeCampaignPlanner implements CampaignPlanner {
  readonly requests: PlanRequest[] = [];
  private readonly failure = new NextFailure<PlanError>();
  private scripted: CampaignPlan | undefined;

  respondWith(plan: CampaignPlan): void {
    this.scripted = plan;
  }

  failNext(error: PlanError): void {
    this.failure.set(error);
  }

  plan(request: PlanRequest): Promise<Result<CampaignPlan, PlanError>> {
    this.requests.push(request);
    const error = this.failure.take();
    if (error) return Promise.resolve(err(error));
    const tasks: ProposedTask[] = [
      ...request.candidates.keywords.slice(0, 2).map((k) => ({
        kind: "seo_article" as const,
        channel: "blog" as const,
        title: `Article: ${k.keyword}`,
        rationale: `${k.keyword} is a realistic keyword to rank for`,
        keyword: k.keyword,
      })),
      ...request.candidates.angles.map((a) => ({
        kind: "social_post" as const,
        channel: a.channel,
        title: a.angle,
        rationale: "Keeps the audience warm",
        angle: a.angle,
      })),
    ].slice(0, request.allowance);
    return Promise.resolve(
      ok(
        this.scripted ?? {
          name: `Week of ${request.week.start.toISOString().slice(0, 10)}`,
          goal: "Grow organic traffic",
          tasks,
        },
      ),
    );
  }
}
