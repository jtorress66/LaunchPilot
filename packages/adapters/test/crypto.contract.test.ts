import {
  describeIdGeneratorContract,
  describePasswordHasherContract,
  describeTokenGeneratorContract,
} from "@launchpilot/testing/contracts";
import { RandomTokenGenerator, ScryptPasswordHasher, UuidIdGenerator } from "../src";

describePasswordHasherContract("ScryptPasswordHasher", () => new ScryptPasswordHasher());
describeTokenGeneratorContract("RandomTokenGenerator", () => new RandomTokenGenerator(), {
  minLength: 43,
});
describeIdGeneratorContract("UuidIdGenerator", () => new UuidIdGenerator());
