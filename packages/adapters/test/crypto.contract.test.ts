import {
  describePasswordHasherContract,
  describeTokenGeneratorContract,
} from "@launchpilot/testing/contracts";
import { RandomTokenGenerator, ScryptPasswordHasher } from "../src";

describePasswordHasherContract("ScryptPasswordHasher", () => new ScryptPasswordHasher());
describeTokenGeneratorContract("RandomTokenGenerator", () => new RandomTokenGenerator(), {
  minLength: 43,
});
