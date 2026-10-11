import { err, ok, type Result } from "@launchpilot/domain";
import type { CampaignPlan, CampaignPlanner, PlanError, PlanRequest } from "@launchpilot/ports";
import { NextFailure } from "./next-failure";

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
    return Promise.resolve(
      ok(
        this.scripted ?? {
          name: `Week of ${request.weekStarting.toISOString().slice(0, 10)}`,
          goal: "Grow organic traffic",
          tasks: [
            {
              kind: "seo_article",
              channel: "blog",
              title: `A guide for ${request.brief.audience}`,
              rationale: "Targets the core audience from the brief",
            },
          ],
        },
      ),
    );
  }
}
