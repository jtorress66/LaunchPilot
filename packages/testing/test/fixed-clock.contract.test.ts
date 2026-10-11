import { describeClockContract } from "../contracts";
import { FixedClock } from "../src/fakes/fixed-clock";

describeClockContract("FixedClock", () => new FixedClock(new Date("2026-01-01T00:00:00.000Z")));
