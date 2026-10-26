import { describeClockContract } from "@nuvantre/testing/contracts";
import { SystemClock } from "../src/clock/system-clock";

describeClockContract("SystemClock", () => new SystemClock());
