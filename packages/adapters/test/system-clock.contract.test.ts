import { describeClockContract } from "@launchpilot/testing/contracts";
import { SystemClock } from "../src/clock/system-clock";

describeClockContract("SystemClock", () => new SystemClock());
