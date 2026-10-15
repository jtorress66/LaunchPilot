import { err, ok, type Result } from "@launchpilot/domain";
import type {
  DraftError,
  LaunchKitDraft,
  LaunchKitDrafter,
  LaunchKitRequest,
} from "@launchpilot/ports";
import { aListing } from "../fixtures/entities";
import { NextFailure } from "./next-failure";

/** A fixed, valid kit named after the product; records requests. */
export class FakeLaunchKitDrafter implements LaunchKitDrafter {
  readonly requests: LaunchKitRequest[] = [];
  private readonly failure = new NextFailure<DraftError>();

  failNext(error: DraftError): void {
    this.failure.set(error);
  }

  draft(request: LaunchKitRequest): Promise<Result<LaunchKitDraft, DraftError>> {
    this.requests.push(request);
    const error = this.failure.take();
    if (error) return Promise.resolve(err(error));
    const { name } = request.product;
    return Promise.resolve(
      ok({
        listing: aListing({ name }),
        community: [
          { channel: "hackernews", title: `Show HN: ${name}`, body: `${name} on HN.` },
          { channel: "reddit", title: `I built ${name}`, body: `${name} on Reddit.` },
          { channel: "indiehackers", title: `Launching ${name}`, body: `${name} on IH.` },
        ],
        citedFacts: request.brief.facts.slice(0, 1),
      }),
    );
  }
}
